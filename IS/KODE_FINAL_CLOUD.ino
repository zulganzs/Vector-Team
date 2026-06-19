#include <ESP32Servo.h>
#include <math.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ============================================================
// WiFi & CLOUD BACKEND
// ============================================================
#define WIFI_SSID     "F"
#define WIFI_PASSWORD "apaan ya"

#define BACKEND_URL   "https://testing-production-3853.up.railway.app"
#define API_KEY       "3a5297bc6d418e212bb843a48ad13467"

const unsigned long POST_INTERVAL_MS = 2000; // Kirim data setiap 2 detik

// ============================================================
// Telegram
// ============================================================
#define BOT_TOKEN     "8562982770:AAEJEcOB4vkWikjmdds7banX4piUKNLh_GQ"
#define CHAT_ID       "7066434675"

const unsigned long TELEGRAM_COOLDOWN_API_MS = 30000;
const unsigned long TELEGRAM_COOLDOWN_AIR_MS = 60000;

// ============================================================
// PIN DEFINITIONS
// ============================================================
#define TRIG_PIN      5
#define ECHO_PIN      18
#define FLAME_PIN     13
#define RELAY_PIN     15
#define LED_PIN       2
#define SMOKE_PIN     34
#define SERVO1_PIN    19
#define SERVO2_PIN    22
#define BUZZER_PIN    25

// ============================================================
// KONSTANTA SENSOR & KALIBRASI
// ============================================================
#define SOUND_SPEED         0.034
#define PUMP_ON_TIME        5000

#define TINGGI_WADAH        11.0f
#define BATAS_50_PERSEN     6.6f
#define BATAS_PENUH         2.0f
#define TINGGI_AIR_MAX      9.0f

#define MQ2_RL              10.0f
#define PPM_BATAS_BAWAH     650.0f
#define PPM_BATAS_ATAS      4000.0f

const int FALLBACK_BASELINE = 300;
const int JUMLAH_SAMPEL     = 50;
const int OFFSET_ASAP_ON    = 80;
const int OFFSET_ASAP_OFF   = 40;

#define SERVO_INTERVAL      20
#define SERVO1_HOME         90
#define SERVO1_SPEED        3

#define KRETEK_ON_TIME      80
#define KRETEK_OFF_TIME     120
#define KRETEK_PAUSE        600

// ============================================================
// OBJECTS & VARIABLES
// ============================================================
Servo servo1;
Servo servo2;

float distanceCm   = 0;
float nilaiPPM     = 0;
int   nilaiAsap    = 0;
int   flameState   = LOW;

int   baselineMQ2   = FALLBACK_BASELINE;
int   ambangAsapON  = 0;
int   ambangAsapOFF = 0;

bool  pumpRunning    = false;
bool  flameDetected  = false;
bool  asapTerdeteksi = false;
bool  airRendah      = false;
bool  airPenuh       = false;

unsigned long pumpStartTime   = 0;
unsigned long lastSensorRead  = 0;
unsigned long lastServoUpdate = 0;
unsigned long lastBuzzerTone  = 0;
unsigned long kretekTimer     = 0;
unsigned long lastPostTime    = 0;

unsigned long tTelegramApiLast = 0;
unsigned long tTelegramAirLast = 0;
bool telegramApiSent = false;
bool telegramAirSent = false;

int  servo1CurrentAngle = SERVO1_HOME;
int  servo1TargetAngle  = SERVO1_HOME;
bool servo1Moving       = false;

int  servo2Angle  = 0;
int  servo2Dir    = 1;
bool servo2Locked = false;

enum BuzzerMode { BUZZER_OFF, BUZZER_API, BUZZER_ASAP };
BuzzerMode buzzerMode = BUZZER_OFF;
int  buzzerFreq    = 800;
int  buzzerFreqDir = 1;
int  kretekState   = 0;

// ============================================================
// KIRIM DATA KE CLOUD BACKEND
// ============================================================
void postDataToCloud() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CLOUD] WiFi tidak terhubung, skip POST");
    return;
  }

  float airCm     = TINGGI_WADAH - distanceCm;
  float persenAir = (airCm / TINGGI_AIR_MAX) * 100.0f;
  if (persenAir < 0 || distanceCm < 0) persenAir = 0;
  if (persenAir > 100) persenAir = 100;

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  String json = "{";
  json += "\"ppm\":"       + String(nilaiPPM, 1)     + ",";
  json += "\"adc\":"       + String(nilaiAsap)        + ",";
  json += "\"flame\":"     + String(flameState)       + ",";
  json += "\"dist\":"      + String(distanceCm, 1)    + ",";
  json += "\"water_pct\":" + String(persenAir, 1)     + ",";
  json += "\"pump\":"      + String(pumpRunning ? 1 : 0);
  json += "}";

  int httpCode = http.POST(json);
  if (httpCode > 0) {
    Serial.print("[CLOUD] POST berhasil! HTTP: ");
    Serial.println(httpCode);
  } else {
    Serial.print("[CLOUD] POST gagal: ");
    Serial.println(http.errorToString(httpCode));
  }
  http.end();
}

// ============================================================
// TELEGRAM FUNCTIONS
// ============================================================
bool kirimTelegram(String pesan) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  String url = "https://api.telegram.org/bot" + String(BOT_TOKEN) + "/sendMessage";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  pesan.replace("\\", "\\\\");
  pesan.replace("\"", "\\\"");
  String payload = "{\"chat_id\":\"" + String(CHAT_ID) + "\",\"text\":\"" + pesan + "\",\"parse_mode\":\"HTML\"}";
  int httpCode = http.POST(payload);
  if (httpCode > 0) { http.end(); return true; }
  else { Serial.print("[TELEGRAM] Gagal: "); Serial.println(http.errorToString(httpCode)); http.end(); return false; }
}

void kirimNotifKebakaran(int sudut, float ppm) {
  String pesan = "🚨🔥 <b>[ALERT KEBAKARAN]</b>\n\n";
  pesan += "Api & asap terdeteksi!\n\n";
  pesan += "📊 <b>Detail Sensor:</b>\n";
  pesan += "• PPM Asap: <b>" + String(ppm, 0) + " ppm</b>\n";
  pesan += "• Posisi Api: <b>" + String(sudut) + "°</b>\n";
  pesan += "• Pompa: <b>Aktif</b>\n\n";
  pesan += "⚠️ Mohon segera lakukan pengecekan!\n";
  pesan += "🕐 Waktu: " + String(millis() / 1000) + " detik sejak boot\n";
  pesan += "📡 IP: " + WiFi.localIP().toString();
  kirimTelegram(pesan);
}

void kirimNotifAirRendah(float jarak) {
  float persen = max(0.0f, min(100.0f, ((TINGGI_WADAH - jarak) / TINGGI_AIR_MAX) * 100.0f));
  String pesan = "💧⚠️ <b>[PERINGATAN AIR RENDAH]</b>\n\n";
  pesan += "Volume air dalam tangki berada di bawah 50%!\n\n";
  pesan += "📊 <b>Detail:</b>\n";
  pesan += "• Jarak sensor: <b>" + String(jarak, 1) + " cm</b>\n";
  pesan += "• Estimasi volume: <b>" + String(persen, 0) + "%</b>\n";
  pesan += "• Batas aman: <b>" + String(BATAS_50_PERSEN, 1) + " cm</b>\n\n";
  pesan += "🔧 Segera isi ulang tangki air!\n";
  pesan += "🕐 Waktu: " + String(millis() / 1000) + " detik sejak boot";
  kirimTelegram(pesan);
}

void kirimNotifNormal() {
  String pesan = "✅ <b>[STATUS NORMAL]</b>\n\n";
  pesan += "Api telah padam. Sistem kembali ke mode monitoring.\n";
  pesan += "Pompa telah dimatikan secara otomatis.\n";
  pesan += "🕐 Waktu: " + String(millis() / 1000) + " detik sejak boot";
  kirimTelegram(pesan);
}

// ============================================================
// MQ2 CALIBRATION
// ============================================================
int kalibrasiBaseline() {
  Serial.println("[KALIBRASI] Mengukur baseline MQ-2...");
  long total = 0;
  for (int i = 0; i < JUMLAH_SAMPEL; i++) {
    total += analogRead(SMOKE_PIN);
    delay(50);
  }
  return total / JUMLAH_SAMPEL;
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("===========================================");
  Serial.println("=== Fire, Flood & Smoke Detection v5.2 ===");
  Serial.println("===   CLOUD BACKEND MODE              ===");
  Serial.println("===========================================");

  pinMode(TRIG_PIN,   OUTPUT);
  pinMode(ECHO_PIN,   INPUT);
  pinMode(FLAME_PIN,  INPUT);
  pinMode(RELAY_PIN,  OUTPUT);
  pinMode(LED_PIN,    OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN,  LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // WiFi
  Serial.print("[WiFi] Menghubungkan ke: "); Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\n[WiFi] Terhubung!");
  Serial.print("[WiFi] IP: "); Serial.println(WiFi.localIP());

  // Kalibrasi MQ2
  baselineMQ2   = kalibrasiBaseline();
  ambangAsapON  = baselineMQ2 + OFFSET_ASAP_ON;
  ambangAsapOFF = baselineMQ2 + OFFSET_ASAP_OFF;
  Serial.print("[MQ2] Baseline: "); Serial.println(baselineMQ2);

  // Servo
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);
  for (int i = 0; i <= 180; i += 5) { servo1.write(i); servo2.write(i); delay(20); }
  for (int i = 180; i >= 0; i -= 5) { servo1.write(i); servo2.write(i); delay(20); }
  servo1.write(SERVO1_HOME);
  servo2.write(0);

  Serial.println("[CLOUD] Backend URL: " + String(BACKEND_URL));
  Serial.println("[CLOUD] Mulai kirim data setiap 2 detik...");
  Serial.println("-------------------------------------------");
}

// ============================================================
// LOOP
// ============================================================
void loop() {
  unsigned long now = millis();

  // Servo update
  if (now - lastServoUpdate >= SERVO_INTERVAL) {
    lastServoUpdate = now;
    if (servo1CurrentAngle != servo1TargetAngle) {
      if (servo1CurrentAngle < servo1TargetAngle) {
        servo1CurrentAngle += SERVO1_SPEED;
        if (servo1CurrentAngle > servo1TargetAngle) servo1CurrentAngle = servo1TargetAngle;
      } else {
        servo1CurrentAngle -= SERVO1_SPEED;
        if (servo1CurrentAngle < servo1TargetAngle) servo1CurrentAngle = servo1TargetAngle;
      }
      servo1.write(servo1CurrentAngle);
      servo1Moving = (servo1CurrentAngle != servo1TargetAngle);
    } else { servo1Moving = false; }

    if (!servo2Locked) {
      servo2Angle += servo2Dir * 2;
      if (servo2Angle >= 180) { servo2Angle = 180; servo2Dir = -1; }
      if (servo2Angle <= 0)   { servo2Angle = 0;   servo2Dir =  1; }
      servo2.write(servo2Angle);
    }
  }

  updateBuzzer(now);

  // Baca sensor setiap 1 detik
  if (now - lastSensorRead >= 1000) {
    lastSensorRead = now;

    distanceCm = readUltrasonic();
    bacaSensorAsap();
    flameState = digitalRead(FLAME_PIN);

    // Logika air
    if (distanceCm > 0) {
      if (distanceCm <= BATAS_PENUH) {
        airPenuh = true; airRendah = false;
        digitalWrite(LED_PIN, LOW);
        telegramAirSent = false;
      } else if (distanceCm >= BATAS_50_PERSEN) {
        airPenuh = false; airRendah = true;
        digitalWrite(LED_PIN, HIGH);
        if (!telegramAirSent || (now - tTelegramAirLast >= TELEGRAM_COOLDOWN_AIR_MS)) {
          kirimNotifAirRendah(distanceCm);
          tTelegramAirLast = now;
          telegramAirSent = true;
        }
      } else {
        airPenuh = false; airRendah = false;
        digitalWrite(LED_PIN, LOW);
        telegramAirSent = false;
      }
    }

    // Logika api & asap
    if (flameState == HIGH) {
      if (!flameDetected) {
        flameDetected = true;
        if (servo2Angle <= 60)       servo1TargetAngle = 0;
        else if (servo2Angle <= 120) servo1TargetAngle = 90;
        else                         servo1TargetAngle = 180;
        servo2Locked = true;
        if (!telegramApiSent || (now - tTelegramApiLast >= TELEGRAM_COOLDOWN_API_MS)) {
          kirimNotifKebakaran(servo2Angle, nilaiPPM);
          tTelegramApiLast = now;
          telegramApiSent = true;
        }
      }
      controlPump(true);
      setBuzzer(BUZZER_API);
    }
    else if (asapTerdeteksi) {
      if (flameDetected) {
        flameDetected = false; servo1TargetAngle = SERVO1_HOME; servo2Locked = false;
        kirimNotifNormal(); telegramApiSent = false;
      }
      controlPump(false);
      setBuzzer(BUZZER_ASAP);
    }
    else {
      if (flameDetected) {
        flameDetected = false; servo1TargetAngle = SERVO1_HOME; servo2Locked = false;
        kirimNotifNormal(); telegramApiSent = false;
      }
      controlPump(false);
      setBuzzer(BUZZER_OFF);
    }

    if (pumpRunning && (now - pumpStartTime >= PUMP_ON_TIME)) {
      if (flameState == HIGH) { pumpStartTime = now; }
      else { controlPump(false); }
    }

    printStatus();
  }

  // Kirim data ke cloud setiap POST_INTERVAL_MS
  if (now - lastPostTime >= POST_INTERVAL_MS) {
    lastPostTime = now;
    postDataToCloud();
  }
}

// ============================================================
// SENSOR FUNCTIONS
// ============================================================
float readUltrasonic() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long dur = pulseIn(ECHO_PIN, HIGH, 10000);
  if (dur == 0) return -1;
  return dur * SOUND_SPEED / 2;
}

float hitungPPM(int adcNow, int adcBaseline) {
  if (adcNow <= 0 || adcBaseline <= 0) return 0;
  float vNow      = (adcNow      / 4095.0f) * 3.3f;
  float vBaseline = (adcBaseline / 4095.0f) * 3.3f;
  if (vNow <= 0 || vBaseline <= 0)       return 0;
  if (vNow >= 3.3f || vBaseline >= 3.3f) return 0;
  float Rs = ((3.3f - vNow)      / vNow)      * MQ2_RL;
  float Ro = ((3.3f - vBaseline) / vBaseline) * MQ2_RL;
  if (Ro <= 0 || Rs <= 0) return 0;
  float ratio = Rs / Ro;
  if (ratio <= 0) return 0;
  float ppm = 3616.1f * powf(ratio, -2.675f);
  if (ppm < 0)    ppm = 0;
  if (ppm > 9999) ppm = 9999;
  return ppm;
}

void bacaSensorAsap() {
  nilaiAsap = analogRead(SMOKE_PIN);
  nilaiPPM  = hitungPPM(nilaiAsap, baselineMQ2);
  if (!asapTerdeteksi) { if (nilaiAsap > ambangAsapON)  asapTerdeteksi = true; }
  else                 { if (nilaiAsap < ambangAsapOFF) asapTerdeteksi = false; }
}

// ============================================================
// BUZZER
// ============================================================
void setBuzzer(BuzzerMode mode) {
  if (buzzerMode != mode) {
    buzzerMode = mode; kretekState = 0;
    if (mode == BUZZER_OFF) { noTone(BUZZER_PIN); digitalWrite(BUZZER_PIN, LOW); }
  }
}

void updateBuzzer(unsigned long now) {
  switch (buzzerMode) {
    case BUZZER_API:
      if (now - lastBuzzerTone >= 15) {
        lastBuzzerTone = now;
        buzzerFreq += buzzerFreqDir * 30;
        if (buzzerFreq >= 2000) { buzzerFreq = 2000; buzzerFreqDir = -1; }
        if (buzzerFreq <= 800)  { buzzerFreq = 800;  buzzerFreqDir =  1; }
        tone(BUZZER_PIN, buzzerFreq);
      }
      break;
    case BUZZER_ASAP:
      switch (kretekState) {
        case 0: tone(BUZZER_PIN, 3500); kretekTimer = now; kretekState = 1; break;
        case 1: if (now - kretekTimer >= KRETEK_ON_TIME)  { noTone(BUZZER_PIN); kretekTimer = now; kretekState = 2; } break;
        case 2: if (now - kretekTimer >= KRETEK_OFF_TIME) { kretekState = 3; } break;
        case 3: tone(BUZZER_PIN, 3500); kretekTimer = now; kretekState = 4; break;
        case 4: if (now - kretekTimer >= KRETEK_ON_TIME)  { noTone(BUZZER_PIN); kretekTimer = now; kretekState = 5; } break;
        case 5: if (now - kretekTimer >= KRETEK_PAUSE)    { kretekState = 0; } break;
      }
      break;
    case BUZZER_OFF: default: break;
  }
}

// ============================================================
// PUMP CONTROL
// ============================================================
void controlPump(bool state) {
  if (state && !pumpRunning) {
    digitalWrite(RELAY_PIN, LOW); pumpRunning = true; pumpStartTime = millis();
  } else if (!state && pumpRunning) {
    digitalWrite(RELAY_PIN, HIGH); pumpRunning = false;
  }
}

// ============================================================
// PRINT STATUS
// ============================================================
void printStatus() {
  float airCm     = TINGGI_WADAH - distanceCm;
  float persenAir = (airCm / TINGGI_AIR_MAX) * 100.0f;
  if (persenAir < 0)   persenAir = 0;
  if (persenAir > 100) persenAir = 100;

  Serial.println("-------------------------------------------");
  Serial.print("[AIR] "); Serial.print(persenAir, 1); Serial.print("% | ");
  Serial.print("[ASAP] PPM="); Serial.print(nilaiPPM, 1); Serial.print(" ADC="); Serial.print(nilaiAsap); Serial.print(" | ");
  Serial.print("[FLAME] "); Serial.print(flameState == HIGH ? "API!" : "Aman"); Serial.print(" | ");
  Serial.print("[PUMP] "); Serial.println(pumpRunning ? "ON" : "OFF");
}
