# API Modules

**Base URL:** `https://api.blazewatch.id/api/v1`  
**Content-Type:** `application/json`  
**Auth Header:** `Authorization: Bearer <jwt_token>`  
**IoT Auth Header:** `X-Sensor-API-Key: <api_key>`

---

## 1. Authentication Module

**Route Prefix:** `/api/v1/auth`

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|:---:|:---:|-------------|
| POST | `/auth/login` | ❌ | 5/min | Login, dapat access + refresh token |
| POST | `/auth/logout` | JWT | — | Blacklist token, hapus refresh token |
| POST | `/auth/refresh` | Refresh Token | — | Rotate token pair |
| GET | `/auth/me` | JWT | — | Profile user yang sedang login |

### POST `/auth/login`
```json
// Request
{ "email": "admin@blazewatch.id", "password": "Password123!" }

// Response 200
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "a1b2c3d4...",
    "user": {
      "id": "uuid",
      "name": "Admin User",
      "email": "admin@blazewatch.id",
      "role": "admin"
    }
  }
}
```

---

## 2. Sensor Module

**Route Prefix:** `/api/v1/sensors`

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| POST | `/sensors/data` | API Key | IoT data ingestion |
| GET | `/sensors` | JWT | List semua sensor + status |
| GET | `/sensors/:id` | JWT | Detail satu sensor |
| GET | `/sensors/:id/readings` | JWT | Riwayat pembacaan sensor (paginated) |

### POST `/sensors/data`
```json
// Request (X-Sensor-API-Key header required)
{
  "sensor_id": "sensor-001",
  "zone_id": "uuid-zone",
  "smoke_value": 750,
  "water_flow": 12.5,
  "timestamp": "2026-06-11T10:30:00.000Z"
}

// Response 200
{
  "success": true,
  "data": {
    "classification": "danger",
    "is_duplicate": false,
    "incident_id": "uuid-new-incident"
  }
}
```

### GET `/sensors`
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sensor_code": "sensor-001",
      "type": "combined",
      "status": "online",
      "last_seen_at": "2026-06-11T10:30:00.000Z",
      "zone": { "id": "uuid", "name": "Lantai 1", "building_id": "uuid" }
    }
  ]
}
```

---

## 3. Incident Module

**Route Prefix:** `/api/v1/incidents`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|:---:|------|-------------|
| GET | `/incidents` | JWT | All | List incidents (filtered + paginated) |
| GET | `/incidents/:id` | JWT | All | Detail incident + history |
| PATCH | `/incidents/:id/dismiss` | JWT | building_manager, admin | Dismiss (false alarm) |
| PATCH | `/incidents/:id/acknowledge` | JWT | firefighter, admin | Acknowledge incident |
| PATCH | `/incidents/:id/start-evacuation` | JWT | building_manager, admin | Start evacuation |
| PATCH | `/incidents/:id/mark-in-progress` | JWT | firefighter, admin | Mark en route |
| PATCH | `/incidents/:id/resolve` | JWT | firefighter, admin | Mark resolved |
| PATCH | `/incidents/:id/close` | JWT | building_manager, admin | Close incident |

### GET `/incidents` — Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (e.g., `danger`, `active`) |
| `building_id` | UUID | Filter by building |
| `zone_id` | UUID | Filter by zone |
| `date_from` | ISO 8601 | From date |
| `date_to` | ISO 8601 | To date |
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (default: 20) |

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "danger",
      "severity": "danger",
      "initial_smoke_value": 750,
      "detected_at": "2026-06-11T10:30:00.000Z",
      "building": { "id": "uuid", "name": "Gedung A" },
      "zone": { "id": "uuid", "name": "Lantai 1" },
      "sensor": { "id": "uuid", "sensor_code": "sensor-001" }
    }
  ],
  "meta": { "current_page": 1, "per_page": 20, "total": 5 }
}
```

### PATCH `/incidents/:id/acknowledge`
```json
// Request (optional body)
{ "notes": "En route, ETA 10 minutes" }

// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "acknowledged",
    "acknowledged_at": "2026-06-11T10:35:00.000Z"
  }
}
```

---

## 4. Dashboard Module

**Route Prefix:** `/api/v1/dashboard`

| Method | Endpoint | Auth | Description |
|--------|----------|:---:|-------------|
| GET | `/dashboard/summary` | JWT | Statistik dashboard (cached 30s) |
| GET | `/dashboard/active-incidents` | JWT | List active incidents |
| GET | `/dashboard/sensor-status` | JWT | Status semua sensor |

### GET `/dashboard/summary`
```json
// Response 200
{
  "success": true,
  "data": {
    "total_sensors": 10,
    "sensors_online": 8,
    "sensors_offline": 2,
    "active_incidents": 2,
    "incidents_today": 5,
    "average_smoke_level": 245,
    "last_updated": "2026-06-11T10:30:00.000Z"
  }
}
```

---

## 5. Audit Log Module

**Route Prefix:** `/api/v1/audit-logs`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|:---:|------|-------------|
| GET | `/audit-logs` | JWT | admin only | Query audit logs (paginated) |

### GET `/audit-logs` — Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | UUID | Filter by user |
| `action` | string | Filter by action (e.g., `incident.acknowledged`) |
| `entity_type` | string | Filter by entity type |
| `date_from` | ISO 8601 | From date |
| `date_to` | ISO 8601 | To date |
| `page` | integer | Page number |
| `per_page` | integer | Items per page |

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "action": "incident.acknowledged",
      "entity_type": "incident",
      "entity_id": "uuid",
      "old_values": { "status": "danger" },
      "new_values": { "status": "acknowledged" },
      "ip_address": "192.168.1.1",
      "created_at": "2026-06-11T10:35:00.000Z"
    }
  ],
  "meta": { "current_page": 1, "total": 42 }
}
```

---

## 6. Common Error Responses

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `BAD_REQUEST` | Request tidak valid |
| 401 | `AUTH_TOKEN_MISSING` | Token tidak ada |
| 401 | `AUTH_TOKEN_INVALID` | Token expired/invalid |
| 401 | `AUTH_TOKEN_BLACKLISTED` | Token sudah di-logout |
| 401 | `AUTH_INVALID_CREDENTIALS` | Email/password salah |
| 403 | `FORBIDDEN` | Role tidak punya izin |
| 404 | `NOT_FOUND` | Resource tidak ditemukan |
| 409 | `INVALID_INCIDENT_TRANSITION` | Transisi status tidak valid |
| 422 | `VALIDATION_ERROR` | Payload gagal validasi |
| 423 | `AUTH_ACCOUNT_LOCKED` | Akun terkunci |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit tercapai |
| 500 | `INTERNAL_SERVER_ERROR` | Error tak terduga |

---

## 7. Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `POST /auth/login` | 5 requests/menit per IP |
| `POST /sensors/data` | 60 requests/menit per sensor |
| Semua endpoint lainnya | 60 requests/menit per IP |
