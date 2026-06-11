# BlazeWatch Backend — Documentation

**Version:** v1.0 MVP  
**Team:** Vector  
**Status:** ✅ Completed (10/10 Tasks)  
**Reference:** BlazeWatch SDD Backend v1.0 | PRD v1.0 (28/05/2026)

---

## Quick Navigation

| # | Document | Description |
|---|----------|-------------|
| 1 | [Project Overview](./01-overview.md) | Tujuan, target pengguna, scope MVP, fitur selesai |
| 2 | [Architecture Overview](./02-architecture.md) | Layered architecture, folder structure, naming conventions |
| 3 | [Database Overview](./03-database.md) | Skema tabel, relasi, SQLite WAL, Redis |
| 4 | [Authentication Flow](./04-auth-flow.md) | JWT, Refresh Token, RBAC |
| 5 | [Sensor Data Flow](./05-sensor-data-flow.md) | MQTT & HTTP ingestion, idempotency |
| 6 | [Incident Lifecycle](./06-incident-lifecycle.md) | State machine status kebakaran |
| 7 | [Notification Flow](./07-notification-flow.md) | SMS via BullMQ & Twilio, retry logic |
| 8 | [WebSocket Event Flow](./08-websocket-events.md) | Socket.IO events, broadcast rules |
| 9 | [API Modules](./09-api-modules.md) | Daftar seluruh endpoint REST API |
| 10 | [Deployment Architecture](./10-deployment.md) | Docker Compose, Nginx, multiple containers |
| 11 | [Setup & Installation Guide](./11-setup-guide.md) | Dev setup, environment, migrations, running services |
| 12 | [Completed Features](./12-completed-features.md) | Status 10 task implementasi |

---

## System at a Glance

```
IoT Sensor / Wokwi
      │
      ├── MQTT ──► mosquitto:1883 ──► sensor-listener (mqtt-subscriber.js)
      └── HTTP POST /api/v1/sensors/data ──► app:3000
                                                  │
                              ┌───────────────────┼───────────────────┐
                              ▼                   ▼                   ▼
                       SQLite (file)         Redis 7           BullMQ Queue
                              │                   │                   │
                              │                   │          worker (queue-worker.js)
                              │                   │                   │
                              │                   │              Twilio SMS
                              │                   │
                        socketio:8080 ◄── RealtimeService
                              │
                       Browser (Socket.IO)
```

---

> **Note:** Semua informasi dalam dokumentasi ini diekstrak murni dari file SDD proyek.
> Tidak ada data fiktif atau rekayasa.
