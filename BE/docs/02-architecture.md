# Architecture Overview

---

## 1. Layered Architecture

BlazeWatch menggunakan pola **Controller → Service → Repository**:

```
HTTP Request
     │
     ▼
  Router (routes/*.routes.ts)
     │  applies middleware chain
     ▼
  Middleware (auth, role, rate limit, validation)
     │
     ▼
  Controller (controllers/*.controller.ts)
     │  thin layer — parses req, calls service, returns res
     ▼
  Service (services/*.ts)
     │  core business logic, orchestration
     ├──────────────────────────────────────┐
     ▼                                      ▼
  Repository (repositories/*.ts)     External Services
  SQLite via Knex                     (Twilio, Socket.IO, Redis)
     │
     ▼
  Database (SQLite / Redis)
```

| Layer | File Pattern | Tanggung Jawab |
|-------|-------------|----------------|
| **Router** | `routes/*.routes.ts` | Mendefinisikan route, menerapkan middleware |
| **Middleware** | `middleware/*.ts` | Auth JWT, role check, rate limiting, error handler |
| **Controller** | `controllers/*.controller.ts` | Parse HTTP req/res, delegasi ke service |
| **Service** | `services/*.ts` | Core business logic, orkestrasi komponen |
| **Repository** | `repositories/*.ts` | Abstraksi akses database (Knex queries) |
| **Job / Worker** | `jobs/*.ts` | Proses async via BullMQ |

---

## 2. Entry Points (Multi-Process Architecture)

Setiap proses berjalan sebagai **Docker container terpisah**:

| Container | Entry Point | Peran |
|-----------|------------|-------|
| `app` | `dist/server.ts` | REST API Express + cron jobs |
| `socketio` | `dist/websocket-server.ts` | Socket.IO WebSocket server |
| `worker` | `dist/queue-worker.ts` | BullMQ SMS worker |
| `sensor-listener` | `dist/mqtt-subscriber.ts` | MQTT subscriber process |

---

## 3. Folder Structure

```
src/
├── config/                  # Konfigurasi aplikasi
│   ├── database.ts          # Knex SQLite, WAL mode, foreign keys
│   ├── redis.ts             # ioredis client + retry strategy
│   ├── twilio.ts            # Twilio SDK client
│   └── socketio.ts          # Socket.IO server factory
│
├── middleware/              # Express middleware
│   ├── authMiddleware.ts    # JWT verification + blacklist check
│   ├── roleMiddleware.ts    # RBAC role check factory
│   ├── errorHandler.ts      # Global error handler
│   ├── rateLimiter.ts       # Rate limiting (60/min, 5/min login)
│   └── sensorApiKeyMiddleware.ts  # IoT API key verification
│
├── routes/                  # Route definitions
│   ├── auth.routes.ts
│   ├── sensor.routes.ts
│   ├── incident.routes.ts
│   ├── dashboard.routes.ts
│   └── auditLog.routes.ts
│
├── controllers/             # Request handlers (thin layer)
│   ├── auth.controller.ts
│   ├── sensor.controller.ts
│   ├── incident.controller.ts
│   ├── dashboard.controller.ts
│   └── auditLog.controller.ts
│
├── services/                # Business logic
│   ├── authService.ts
│   ├── sensorProcessingService.ts
│   ├── sensorClassificationService.ts
│   ├── incidentService.ts
│   ├── notificationService.ts
│   ├── realtimeService.ts
│   ├── dashboardService.ts
│   ├── auditLogService.ts
│   └── idempotencyService.ts
│
├── repositories/            # Database access layer
│   ├── userRepository.ts
│   ├── sensorRepository.ts
│   ├── sensorReadingRepository.ts
│   ├── incidentRepository.ts
│   ├── notificationRepository.ts
│   ├── smsLogRepository.ts
│   └── auditLogRepository.ts
│
├── jobs/                    # Async job definitions
│   ├── sendSmsJob.ts        # BullMQ SMS processor
│   └── checkSensorStatusJob.ts  # Sensor offline checker + auto-close
│
├── schemas/                 # Zod validation schemas
│   ├── sensorDataSchema.ts
│   ├── authSchema.ts
│   └── incidentSchema.ts
│
├── types/                   # TypeScript type definitions
│   ├── domain.types.ts      # Entitas domain
│   ├── api.types.ts         # Request/Response types
│   └── enums.ts             # Enum definitions
│
├── errors/                  # Custom error classes
│   ├── AppError.ts
│   ├── AuthenticationError.ts     # 401
│   ├── AuthorizationError.ts      # 403
│   ├── ValidationError.ts         # 422
│   ├── NotFoundError.ts           # 404
│   ├── AccountLockedError.ts      # 423
│   └── InvalidIncidentTransitionError.ts  # 409
│
├── database/
│   ├── migrations/          # 13 Knex migration files
│   └── seeds/               # Demo data seeders
│
├── app.ts                   # Express app setup + route mounting
├── server.ts                # HTTP server entry point + cron scheduler
├── websocket-server.ts      # Socket.IO server entry point
├── queue-worker.ts          # BullMQ worker entry point
└── mqtt-subscriber.ts       # MQTT subscriber entry point
```

---

## 4. Naming Conventions

### File & Module

| Jenis | Konvensi | Contoh |
|-------|---------|--------|
| Controller | `{domain}.controller.ts` | `incident.controller.ts` |
| Service | `{domain}Service.ts` | `incidentService.ts` |
| Repository | `{domain}Repository.ts` | `sensorRepository.ts` |
| Route | `{domain}.routes.ts` | `sensor.routes.ts` |
| Schema (Zod) | `{domain}Schema.ts` | `sensorDataSchema.ts` |
| Job | `{action}Job.ts` | `sendSmsJob.ts` |
| Middleware | `{name}Middleware.ts` | `authMiddleware.ts` |
| Error class | `{Name}Error.ts` | `InvalidIncidentTransitionError.ts` |

### TypeScript Code

| Jenis | Konvensi | Contoh |
|-------|---------|--------|
| Class | PascalCase | `SensorProcessingService` |
| Interface/Type | PascalCase | `IncidentPayload`, `IUserRepository` |
| Enum | PascalCase | `IncidentStatus`, `SensorType` |
| Fungsi/Method | camelCase | `processReading()`, `dispatchNotification()` |
| Variabel | camelCase | `activeIncident`, `smokeValue` |
| Konstanta | UPPER_SNAKE_CASE | `SMOKE_THRESHOLD_WARNING` |

---

## 5. Standard API Response Format

### Success Response

```json
{
  "success": true,
  "data": { },
  "meta": { "current_page": 1, "total": 12 }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error_code": "MACHINE_READABLE_CODE",
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

> Field `errors` hanya ada pada validation errors (HTTP 422).

---

## 6. Import Order Convention

```typescript
// 1. Node.js built-ins
import { randomUUID } from 'crypto';

// 2. Third-party libraries
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// 3. Internal config
import { db } from '../config/database';
import { redisClient } from '../config/redis';

// 4. Services, repositories
import { IncidentService } from '../services/incidentService';
import { SensorRepository } from '../repositories/sensorRepository';

// 5. Types & schemas
import type { SensorReading } from '../types/domain.types';
import { sensorDataSchema } from '../schemas/sensorDataSchema';

// 6. Error classes
import { InvalidIncidentTransitionError } from '../errors/InvalidIncidentTransitionError';
```
