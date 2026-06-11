# Sensor Data Flow

---

## 1. Dual Ingestion Path

BlazeWatch mendukung dua jalur penerimaan data sensor:

```
IoT Sensor / Wokwi
       │
       ├── MQTT ──► Eclipse Mosquitto:1883
       │                    │
       │           sensor-listener container
       │           (mqtt-subscriber.ts)
       │                    │
       └── HTTP POST ──────►┤
           /api/v1/sensors/data  │
           X-Sensor-API-Key      │
                                 ▼
                    SensorProcessingService.processReading()
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             Idempotency   Classify    Persist
             Check         Smoke       sensor_readings
             (Redis)       Value
                    │            │            │
                    ▼            ▼            ▼
             Mark duplicate   Update      Update sensor
             if seen in 5min  sensor      status = online
                              status      + last_seen_at
                                 │            │
                                 ▼            ▼
                           RealtimeService  Redis Cache
                           emit sensor.update  sensor_status
                                 │
                                 ▼
                          IncidentService.evaluateSensorReading()
```

---

## 2. MQTT Subscription (sensor-listener)

| Parameter | Value |
|-----------|-------|
| **Broker** | Eclipse Mosquitto (self-hosted Docker) |
| **Protocol** | MQTT v3.1.1 |
| **Port** | 1883 (plain TCP), 8883 (TLS) |
| **QoS** | Level 1 — at least once delivery |
| **Topic Pattern** | `blazewatch/sensors/+` (wildcard `+` = sensor_code) |
| **Library** | `mqtt` npm package v5.x |

**Proses saat pesan diterima:**
1. Parse JSON payload dari message
2. Ekstrak `sensor_code` dari topic name (e.g., `blazewatch/sensors/sensor-001` → `sensor-001`)
3. Panggil `SensorProcessingService.processReading(payload)`

**Reconnect Strategy:**
- Exponential backoff pada connection error/close
- Log setiap reconnection attempt

---

## 3. HTTP Fallback Ingestion

```
POST /api/v1/sensors/data
X-Sensor-API-Key: <api_key>
Content-Type: application/json
```

**Request Payload:**

```json
{
  "sensor_id": "sensor-001",
  "zone_id": "uuid-zone-id",
  "smoke_value": 750,
  "water_flow": 12.5,
  "timestamp": "2026-06-11T10:30:00.000Z"
}
```

**Zod Validation Rules:**

```typescript
const sensorDataSchema = z.object({
  sensor_id:   z.string().max(100).regex(/^[a-zA-Z0-9-]+$/),
  zone_id:     z.string().max(100),
  smoke_value: z.number().int().min(0).max(4095),
  water_flow:  z.number().min(0).max(10000).optional(),
  timestamp:   z.string().datetime().refine(
    (val) => new Date(val) <= new Date(Date.now() + 60_000),
    { message: 'Timestamp tidak boleh lebih dari 60 detik ke depan' }
  ),
});
```

---

## 4. Idempotency Protection

Mencegah pemrosesan data sensor yang sama dua kali (misal: network retry dari IoT device).

**Redis Key:** `blazewatch:sensor_seen:{sensor_code}:{timestamp_unix}`  
**TTL:** 300 detik (window 5 menit)

```
Incoming Reading
       │
       ▼
  isDuplicate(sensor_code, timestamp_unix)
       │
  ┌────┴────┐
  │ HIT     │ MISS
  ▼         ▼
persist    SET key with TTL 300s
with       process normally
is_duplicate
= true
       │
  Skip IncidentService
```

**Catatan:** Duplicate readings tetap disimpan di `sensor_readings` dengan flag `is_duplicate: true`, namun tidak memicu incident logic.

---

## 5. Smoke Classification Logic

Pure function tanpa side effects:

```typescript
function classify(smokeValue: number): Classification {
  const WARNING_THRESHOLD = parseInt(process.env.SMOKE_THRESHOLD_WARNING ?? '300');
  const DANGER_THRESHOLD  = parseInt(process.env.SMOKE_THRESHOLD_DANGER  ?? '600');

  if (smokeValue > DANGER_THRESHOLD)  return 'danger';
  if (smokeValue >= WARNING_THRESHOLD) return 'warning';
  return 'normal';
}
```

| smoke_value | Classification |
|-------------|---------------|
| < 300 | `normal` |
| 300 – 600 | `warning` |
| > 600 | `danger` |

---

## 6. SensorProcessingService Flow (Lengkap)

Urutan operasi di `processReading(payload)`:

```
1. Validate sensor exists AND is_active = true
         │
         ▼
2. isDuplicate check (Redis)
   → if duplicate: persist with is_duplicate=true, skip step 5+
         │
         ▼
3. classify(smoke_value) → classification
         │
         ▼
4. persist sensor_readings record
         │
         ▼
5. UPDATE sensors SET status='online', last_seen_at=NOW
   UPDATE Redis: blazewatch:sensor_status:{sensor_id}
         │
         ▼
6. If previous status was 'offline':
   emit sensor.online event
   create AuditLog: sensor.online
         │
         ▼
7. emit sensor.update event via RealtimeService
         │
         ▼
8. IncidentService.evaluateSensorReading(
     sensorId, classification, smokeValue,
     waterFlow, sensorTimestamp
   )
```

---

## 7. Validation Error Responses

| Kondisi | HTTP | Error Code |
|---------|------|-----------|
| Missing API key | 401 | `AUTH_API_KEY_MISSING` |
| Invalid API key | 403 | `AUTH_API_KEY_INVALID` |
| Invalid payload fields | 422 | `VALIDATION_ERROR` |
| `smoke_value` out of range | 422 | `VALIDATION_ERROR` |
| Timestamp > 60 detik ke depan | 422 | `VALIDATION_ERROR` |
| Rate limit exceeded (60/min) | 429 | `RATE_LIMIT_EXCEEDED` |
| Sensor tidak terdaftar | 404 | `SENSOR_NOT_FOUND` |

---

## 8. Sensor Monitoring (Offline Detection)

**Scheduled Job:** `checkSensorStatusJob()` — via `node-cron` setiap 30 detik

```
cron.schedule('*/30 * * * * *', async () => {
  await checkSensorStatusJob();
});
```

**Logic:**
1. Query sensors WHERE `last_seen_at < NOW - 60 seconds` AND `status != 'offline'`
2. Untuk setiap sensor ditemukan:
   - UPDATE `status = 'offline'` di DB
   - UPDATE Redis cache `blazewatch:sensor_status:{sensor_id}`
   - `emit sensor.offline { sensor_id, sensor_code, zone_id, last_seen_at }`
   - Create AuditLog entry `sensor.offline`

**Online Recovery:**
- Saat offline sensor mengirim reading → `processReading()` deteksi `previous_status = offline`
- Update status ke `online`, emit `sensor.online`, log audit `sensor.online`
- Recovery time < 30 detik dari data pertama diterima
