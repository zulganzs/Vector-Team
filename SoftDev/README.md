# KODE_FINAL: Sistem Monitoring Kebakaran & Asap IoT

Sistem pemantauan cerdas berbasis IoT yang dirancang untuk mendeteksi potensi kebakaran secara real-time. Perangkat menggunakan sensor MQ2 (asap) dan sensor api yang dipadukan dengan ESP32, mengirimkan data ke dasbor berbasis web agar pengguna dapat memantau status keamanan gedung atau area secara langsung dari perangkat mobile maupun desktop.

## Fitur Utama

- 🌡️ **Monitoring Real-Time**: Pemantauan sensor asap, api, dan level air setiap 2 detik.
- 📍 **Peta Lokasi**: Visualisasi posisi perangkat menggunakan Leaflet dan OpenStreetMap.
- 📱 **Dukungan PWA**: Dapat diinstal sebagai aplikasi di smartphone untuk kemudahan akses.
- 📡 **Status Koneksi**: Deteksi otomatis status koneksi perangkat (online/offline).
- 📊 **Riwayat Data**: Penyimpanan data historis untuk analisis keamanan.

## Teknologi

- **Frontend**: HTML5, CSS3, JavaScript, Leaflet.js (PWA ready).
- **Backend**: Node.js, Express.js.
- **IoT**: IoT: ESP32, Arduino IDE, Sensor Flame, Sensor Gas MQ-2, Sensor Ultrasonik, Servo, Relay, Water Pump, Buzzer.
- **Deployment**: Vercel (Frontend), Railway (Backend).

## Struktur Proyek

```text
Vector-Team/
│
├── SoftDev/                              # Folder utama proyek Software Development
│   │
│   ├── backend/                          # API server berbasis Express.js
│   │   ├── server.js                     # Logika server utama (routes, middleware, API)
│   │   ├── package.json                  # Konfigurasi dependensi & scripts
│   │   ├── package-lock.json             # Lock file dependensi
│   │   ├── render.yaml                   # Konfigurasi deployment ke Render/Railway
│   │   ├── .gitignore                    # Git ignore rules
│   │   ├── KODE_IoT_API.postman_collection.json      # Postman collection untuk testing API
│   │   ├── KODE_IoT_Local.postman_environment.json   # Environment variables (local)
│   │   └── KODE_IoT_Production.postman_environment.json # Environment variables (production)
│   │
│   ├── frontend/                         # Antarmuka dasbor pengguna (PWA)
│   │   ├── index.html                    # Halaman dasbor utama (monitoring real-time)
│   │   ├── map.html                      # Halaman peta lokasi perangkat
│   │   ├── manifest.json                 # Konfigurasi PWA (installable app)
│   │   ├── sw.js                         # Service Worker (offline caching)
│   │   ├── vercel.json                   # Konfigurasi deployment ke Vercel
│   │   ├── .gitignore                    # Git ignore rules
│   │   ├── icons/                        # Ikon untuk PWA
│   │   │   ├── icon-192.png              # Ikon 192x192 (Android)
│   │   │   └── icon-512.png              # Ikon 512x512 (splash screen)
│   │   └── js/                           # JavaScript modules (ES6)
│   │       ├── app.js                    # Main application logic (index page)
│   │       ├── api.js                    # API integration & HTTP requests
│   │       ├── state.js                  # State management (index page)
│   │       ├── ui.js                     # UI rendering & DOM manipulation (index page)
│   │       ├── map-app.js                # Main application logic (map page)
│   │       ├── map-api.js                # API integration (map page)
│   │       ├── map-state.js              # State management (map page)
│   │       └── map-ui.js                 # UI rendering (map page)
│   │
│   └── README.md                         # Dokumentasi utama proyek
│
└── IS/                                   # Intelligence System (Hardware & Firmware)
    ├── KODE_FINAL_CLOUD.ino              # Firmware ESP32 (WiFi, HTTP, Sensor)
    └── assets/                           # Dokumentasi hardware
```

## Panduan Instalasi

### 1. Backend

```bash
# Masuk ke direktori backend
cd SoftDev/backend

# Install dependensi
npm install

# Jalankan server lokal
npm start
# Server akan berjalan di http://localhost:3000

# (Opsional) Jalankan dengan auto-reload untuk development
npm run dev
```

**Environment Variables** (opsional):
```bash
# Buat file .env di folder backend
PORT=3000
API_KEY=KODE_IOT_SECRET_KEY_2024
```

### 2. Frontend

```bash
# Masuk ke direktori frontend
cd SoftDev/frontend

# Buka index.html langsung di browser
open index.html

# ATAU gunakan live server untuk development
npx live-server --port=8080
# Frontend akan berjalan di http://localhost:8080
```

**Catatan**: Pastikan backend sudah berjalan di port 3000 agar data dapat dimuat.

### 3. Testing API dengan Postman

```bash
# Import collection Postman dari folder backend
File: SoftDev/backend/KODE_IoT_API.postman_collection.json

# Import environment variables
File: SoftDev/backend/KODE_IoT_Local.postman_environment.json

# Pilih environment "KODE IoT - Local Development"
# Jalankan semua request untuk testing
```

### 4. ESP32

1. Buka file `IS/KODE_FINAL_CLOUD.ino` di Arduino IDE.
2. Atur kredensial WiFi:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Atur API endpoint:
   ```cpp
   const char* serverUrl = "https://testing-production-3853.up.railway.app/api/data";
   ```
4. Upload ke ESP32 (Board: ESP32 Dev Module).

## Dokumentasi API

### Base URL

```
https://testing-production-3853.up.railway.app
```

### Authentication

Endpoint `POST /api/data` memerlukan header autentikasi:
```
x-api-key: KODE_IOT_SECRET_KEY_2024
```

### Endpoints

| Endpoint | Metode | Auth | Deskripsi |
| :--- | :--- | :--- | :--- |
| `/` | GET | - | Informasi API & daftar endpoint |
| `/api/data` | POST | ✓ | Mengirim data sensor dari ESP32 |
| `/api/data` | GET | - | Mengambil data sensor terbaru |
| `/api/status` | GET | - | Mengecek status koneksi ESP32 |
| `/api/history` | GET | - | Mengambil 100 data terakhir |
| `/api/health` | GET | - | Cek kesehatan server & uptime |

### Contoh Response

**GET /api/data** - Data sensor terbaru:
```json
{
  "ppm": 250,
  "adc": 1024,
  "flame": 0,
  "dist": 2.5,
  "water_pct": 95,
  "pump": 0,
  "timestamp": "2026-06-20T05:57:32.543Z",
  "esp_connected": false
}
```

**POST /api/data** - Kirim data sensor:
```json
// Request Body
{
  "ppm": 120.5,
  "adc": 800,
  "flame": 0,
  "dist": 15.3,
  "water_pct": 75.5,
  "pump": 1
}

// Response
{
  "status": "ok",
  "received": { ... }
}
```

### Postman Collection

Untuk testing API, gunakan collection yang telah disediakan:
- `SoftDev/backend/KODE_IoT_API.postman_collection.json` - Koleksi semua endpoint
- `SoftDev/backend/KODE_IoT_Local.postman_environment.json` - Variabel untuk local development
- `SoftDev/backend/KODE_IoT_Production.postman_environment.json` - Variabel untuk production |


## Instruksi Deployment

### Frontend (Vercel)

1. Push kode ke GitHub
2. Login ke [Vercel](https://vercel.com)
3. Import repository `Vector-Team`
4. Set root directory ke `SoftDev/frontend`
5. Deploy otomatis

### Backend (Railway)

1. Push kode ke GitHub
2. Login ke [Railway](https://railway.app)
3. Create New Project → Deploy from GitHub
4. Set root directory ke `SoftDev/backend`
5. Set environment variables:
   - `API_KEY` = `KODE_IOT_SECRET_KEY_2024`
6. Deploy

### ESP32

1. Update URL server di kode Arduino (`IS/KODE_FINAL_CLOUD.ino`)
2. Upload ke ESP32 menggunakan Arduino IDE
3. Pastikan ESP32 terhubung ke WiFi

## Kontributor

- M. Faizul Kamal - SoftDev
- Lintang Metyaputri - Intelligence System
- Rafania Chindy - Intelligence System
