# WebSocket Event Flow

---

## 1. Socket.IO Server Setup

| Parameter | Value |
|-----------|-------|
| **Library** | Socket.IO 4.x |
| **Protocol** | WebSocket (WSS in production) |
| **Port** | 8080 (proxied oleh Nginx) |
| **Entry Point** | `dist/websocket-server.js` (container: `socketio`) |
| **CORS Origin** | `SOCKETIO_CORS_ORIGIN` env var |
| **Auth Method** | JWT via `socket.handshake.auth.token` |

---

## 2. Connection Authentication

```
Client                        Socket.IO Server
  │                                  │
  │── io.connect({ auth: {          │
  │     token: "<jwt>"              │
  │   }})                           │
  │                                  │── verify JWT signature
  │                                  │── check jti blacklist (Redis)
  │                                  │── if valid: attach user to socket.data
  │                                  │── join room: building:{buildingId}
  │◄── connected ────────────────────│
  │                                  │
  │   (invalid JWT)                  │
  │◄── connect_error ────────────────│
```

---

## 3. Room-Based Broadcasting

Klien bergabung ke room berdasarkan `building_id` mereka:

```
Socket Room: building:{buildingId}
             e.g., building:uuid-building-123
```

**Broadcasting Rules:**
- `emitToBuilding(buildingId, event, payload)` → hanya klien di room itu
- `emit(event, payload)` → semua klien yang terhubung

---

## 4. RealtimeService (Singleton)

```typescript
// Initialization (di server.ts & websocket-server.ts)
RealtimeService.initialize(io);

// Usage di service lain
RealtimeService.emitSensorUpdate(sensorData);
RealtimeService.emitIncidentCreated(incident);
// ...
```

**Catatan:** RealtimeService harus diinisialisasi sebelum services lain memanggil emit.

---

## 5. Event Catalog

### `sensor.update`
**Trigger:** Sensor data diterima dan diproses  
**Payload:**
```json
{
  "sensor_id": "uuid",
  "sensor_code": "sensor-001",
  "zone_id": "uuid",
  "status": "online",
  "smoke_value": 750,
  "water_flow": 12.5,
  "classification": "danger",
  "last_seen_at": "2026-06-11T10:30:00.000Z",
  "timestamp": "2026-06-11T10:30:00.000Z"
}
```

---

### `sensor.offline`
**Trigger:** Sensor tidak mengirim data > 60 detik (detected by cron job)  
**Payload:**
```json
{
  "sensor_id": "uuid",
  "sensor_code": "sensor-001",
  "zone_id": "uuid",
  "last_seen_at": "2026-06-11T10:28:55.000Z",
  "timestamp": "2026-06-11T10:30:00.000Z"
}
```

---

### `sensor.online`
**Trigger:** Sensor yang sebelumnya offline mengirim data lagi  
**Payload:**
```json
{
  "sensor_id": "uuid",
  "sensor_code": "sensor-001",
  "zone_id": "uuid",
  "timestamp": "2026-06-11T10:31:00.000Z"
}
```

---

### `incident.created`
**Trigger:** Incident baru dibuat oleh SensorProcessingService  
**Payload:**
```json
{
  "incident": {
    "id": "uuid",
    "building_id": "uuid",
    "zone_id": "uuid",
    "sensor_id": "uuid",
    "status": "danger",
    "severity": "danger",
    "initial_smoke_value": 750,
    "initial_water_flow": 12.5,
    "detected_at": "2026-06-11T10:30:00.000Z",
    "created_at": "2026-06-11T10:30:00.500Z"
  },
  "timestamp": "2026-06-11T10:30:00.500Z"
}
```

---

### `incident.updated`
**Trigger:** Status incident berubah (any transition)  
**Payload:**
```json
{
  "incident_id": "uuid",
  "previous_status": "danger",
  "new_status": "acknowledged",
  "changed_by": "uuid-firefighter-id",
  "timestamp": "2026-06-11T10:35:00.000Z"
}
```

---

### `notification.sent`
**Trigger:** SMS berhasil dikirim ke Damkar  
**Payload:**
```json
{
  "notification_id": "uuid",
  "incident_id": "uuid",
  "status": "sent",
  "sent_at": "2026-06-11T10:30:20.000Z",
  "timestamp": "2026-06-11T10:30:20.000Z"
}
```

---

## 6. Event Emitter Map (Where Events Are Triggered)

| Event | Triggered In |
|-------|-------------|
| `sensor.update` | `SensorProcessingService.processReading()` |
| `sensor.offline` | `checkSensorStatusJob()` (cron) |
| `sensor.online` | `SensorProcessingService.processReading()` (on recovery) |
| `incident.created` | `IncidentService.createIncident()` |
| `incident.updated` | `IncidentService.transitionStatus()` |
| `notification.sent` | `sendSmsJob.ts` (BullMQ worker) |

---

## 7. Performance Target

| Metric | Target |
|--------|--------|
| Event delivery setelah trigger | < 2 detik |
| Status update end-to-end (sensor → dashboard) | < 5 detik |
| Reconnect setelah disconnect | Graceful (Socket.IO built-in) |
