# Notification Flow

---

## 1. SMS Dispatch Overview

```
DANGER Incident Created/Updated
             │
             ▼
  NotificationService.dispatchSmsForIncident(incident)
             │
    ┌────────┴────────────────────────────────┐
    │ 1. Fetch building + zone details        │
    │ 2. Build SMS message from template      │
    │ 3. CREATE notifications record          │
    │    status = 'pending'                   │
    │ 4. Enqueue BullMQ job to 'sms' queue   │
    │    { notificationId, phone, message }   │
    │ 5. AuditLog: notification.queued        │
    └─────────────────────────────────────────┘
             │
             ▼
        Redis Queue (BullMQ)
             │
             ▼
  worker container (queue-worker.ts)
  BullMQ Worker processes job
             │
    ┌────────┴────────────────────────────────┐
    │ 1. Fetch notification record            │
    │ 2. Call Twilio: messages.create(...)    │
    │ 3. CREATE sms_logs record               │
    │    (Twilio SID, status, attempt_number) │
    │ 4. UPDATE notifications.status = 'sent' │
    │    SET sent_at = NOW                    │
    └─────────────────────────────────────────┘
```

---

## 2. SMS Message Template

```
🚨 KEBAKARAN TERDETEKSI 🚨
Gedung: {building_name}
Lokasi: {zone_name}
Alamat: {building_address}
Asap: {smoke_value} PPM
Air: {water_flow} L/min
Waktu: {detected_at}
Dashboard: {APP_URL}/incidents/{incident_id}
```

**Penerima:** Nomor telepon Damkar dari environment variable `FIREFIGHTER_PHONE_NUMBER`  
**Pengirim:** Nomor Twilio dari `TWILIO_FROM_NUMBER`

---

## 3. BullMQ Job Configuration

```typescript
// Job options
{
  attempts: 3,                      // Max retry attempts
  backoff: {
    type: 'exponential',
    delay: 10_000                   // Initial delay: 10 detik
  }
}
// Retry delays: 10s → 30s → 60s
```

| Attempt | Delay Before Retry |
|---------|--------------------|
| 1st attempt | Immediate |
| 2nd attempt (retry 1) | 10 detik |
| 3rd attempt (retry 2) | ~30 detik |
| After 3 failures | Status = `failed` |

---

## 4. Retry Logic & Status Transitions

```
notifications.status flow:

pending → (job processing) → sent
                          └─► retrying (on failure, retry < 3)
                          └─► failed (on failure, retry = 3)
```

| Event | notifications.status | sms_logs entry |
|-------|---------------------|----------------|
| Job enqueued | `pending` | — |
| Attempt 1 success | `sent` | status=`sent`, attempt=1 |
| Attempt 1 failure | `retrying` | status=`failed`, attempt=1, error logged |
| Attempt 2 success | `sent` | status=`sent`, attempt=2 |
| Attempt 2 failure | `retrying` | status=`failed`, attempt=2 |
| Attempt 3 failure | `failed` | status=`failed`, attempt=3 |

---

## 5. SMS Log (`sms_logs`) per Attempt

```json
{
  "id": "uuid",
  "notification_id": "uuid",
  "twilio_sid": "SM1234567890abcdef",
  "recipient_phone": "+628119999999",
  "status": "sent",
  "error_code": null,
  "error_message": null,
  "attempt_number": 1,
  "created_at": "2026-06-11T10:30:05.000Z"
}
```

Pada failure:
```json
{
  "twilio_sid": null,
  "status": "failed",
  "error_code": "21211",
  "error_message": "The 'To' number +628119999999 is not a valid phone number",
  "attempt_number": 1
}
```

---

## 6. Queue Worker Entry Point (`queue-worker.ts`)

```typescript
// Lifecycle:
// 1. Initialize Redis connection (ioredis)
// 2. Create BullMQ Worker for 'sms' queue
// 3. Register sendSmsJob processor
// 4. On SIGTERM: graceful shutdown
//    - worker.close()
//    - redis.disconnect()
```

**Catatan penting:**
- `queue-worker.ts` adalah standalone entry point — **tidak pernah di-import ke `server.ts`**
- Berjalan sebagai container `worker` yang terpisah
- Jika Redis `appendonly yes` aktif, jobs tidak hilang saat container restart

---

## 7. Notification Trigger Conditions

| Kondisi | SMS Dikirim? |
|---------|-------------|
| Incident severity = `warning` | ❌ Tidak |
| Incident severity = `danger` | ✅ Ya |
| Incident status = `danger` (escalation dari warning) | ✅ Ya |
| Auto-resolve ke `normal` | ❌ Tidak |
| Duplicate reading (is_duplicate=true) | ❌ Tidak |

---

## 8. Performance Target

| Metric | Target |
|--------|--------|
| SMS job enqueued setelah DANGER | < 5 detik |
| SMS terkirim ke Damkar | < 30 detik sejak deteksi |
| Graceful degradation | Sistem tetap jalan jika SMS gagal |
