# Database Overview

---

## 1. Database Engine

| Parameter | Value |
|-----------|-------|
| **Engine** | SQLite 3.x (file-based) |
| **File Location** | `./data/blazewatch.sqlite` (Docker volume: `sqlite_data`) |
| **Query Builder** | Knex.js 3.x |
| **WAL Mode** | `PRAGMA journal_mode=WAL` (aktif saat startup) |
| **Foreign Keys** | `PRAGMA foreign_keys=ON` (aktif saat startup) |
| **UUID Generation** | `randomUUID()` dari Node.js `crypto` (bukan database-generated) |
| **Timestamps** | TEXT ISO 8601 (bukan DATETIME native SQLite) |
| **Soft Delete** | `deleted_at` timestamp nullable |

### Alasan Memilih SQLite

- Cukup untuk MVP single-server, zero-config
- Tidak memerlukan container database terpisah
- File-based, mudah di-backup dan diportabilitas

---

## 2. Tabel Utama

### `roles`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `name` | VARCHAR UNIQUE | `admin`, `building_manager`, `firefighter` |
| `created_at` | TEXT ISO 8601 | |
| `updated_at` | TEXT ISO 8601 | |

---

### `users`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `name` | VARCHAR 255 | |
| `email` | VARCHAR 255 UNIQUE | |
| `password` | VARCHAR 255 | bcrypt hash, cost factor 12 |
| `role_id` | UUID FK → roles | |
| `phone_number` | VARCHAR 20 | nullable |
| `is_active` | BOOLEAN | default true |
| `failed_login_attempts` | INTEGER | default 0 |
| `locked_until` | TEXT | nullable, ISO 8601 |
| `last_login_at` | TEXT | nullable, ISO 8601 |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |
| `deleted_at` | TEXT | nullable, soft delete |

---

### `buildings`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `name` | VARCHAR 255 | |
| `address` | TEXT | |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |
| `deleted_at` | TEXT | nullable |

---

### `zones`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `building_id` | UUID FK → buildings CASCADE | |
| `name` | VARCHAR 255 | |
| `floor` | VARCHAR 50 | nullable |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |
| `deleted_at` | TEXT | nullable |

---

### `sensors`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `sensor_code` | VARCHAR 100 UNIQUE | Kode sensor dari IoT device |
| `zone_id` | UUID FK → zones | |
| `type` | ENUM | `smoke`, `water_flow`, `combined` |
| `status` | ENUM | `online`, `offline`, `unknown` — DEFAULT unknown |
| `last_seen_at` | TEXT | nullable, diupdate saat data diterima |
| `is_active` | BOOLEAN | default true |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |
| `deleted_at` | TEXT | nullable |

**Indexes:**
- `sensors_sensor_code_idx` — UNIQUE INDEX on `sensor_code`

---

### `sensor_readings`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `sensor_id` | UUID FK → sensors | |
| `zone_id` | UUID FK → zones | **Denormalized** — untuk performa query dashboard |
| `smoke_value` | INTEGER | 0–4095 (ADC range) |
| `water_flow` | DECIMAL(8,2) | nullable, 0–10000 L/min |
| `status_classification` | ENUM | `normal`, `warning`, `danger` |
| `sensor_timestamp` | TEXT | Timestamp dari sensor device |
| `received_at` | TEXT | Timestamp saat server menerima data |
| `is_duplicate` | BOOLEAN | default false — idempotency flag |
| `created_at` | TEXT | |

**Indexes:**
- INDEX on `(sensor_id, received_at DESC)`

> **Catatan arsitektural:** `zone_id` di-denormalisasi secara sengaja untuk menghindari JOIN ke `sensors` pada setiap query dashboard.

---

### `incidents`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `building_id` | UUID FK → buildings | |
| `zone_id` | UUID FK → zones | |
| `sensor_id` | UUID FK → sensors | |
| `status` | ENUM | lihat state machine di bawah |
| `severity` | ENUM | `warning`, `danger` |
| `initial_smoke_value` | INTEGER | Nilai asap saat incident dibuat |
| `initial_water_flow` | DECIMAL(8,2) | nullable |
| `detected_at` | TEXT | Timestamp dari sensor |
| `acknowledged_at` | TEXT | nullable |
| `resolved_at` | TEXT | nullable |
| `closed_at` | TEXT | nullable |
| `dismissed_at` | TEXT | nullable |
| `dismissed_by` | UUID FK → users | nullable |
| `notes` | TEXT | nullable |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**Indexes:**
- INDEX on `(sensor_id, status)` — untuk query "active incident per sensor"

---

### `incident_statuses`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `incident_id` | UUID FK → incidents | |
| `previous_status` | VARCHAR | |
| `new_status` | VARCHAR | |
| `changed_by` | UUID FK → users | nullable (null = system) |
| `reason` | TEXT | nullable |
| `created_at` | TEXT | |

> Tabel ini terpisah dari `audit_logs` untuk memberikan riwayat state machine yang bersih dan queryable.

---

### `notifications`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `incident_id` | UUID FK → incidents | |
| `type` | ENUM | `sms`, `in_app` |
| `recipient_id` | UUID FK → users | nullable |
| `recipient_phone` | VARCHAR 20 | nullable |
| `message_body` | TEXT | Isi pesan SMS |
| `status` | ENUM | `pending`, `sent`, `failed`, `retrying` |
| `retry_count` | INTEGER | default 0, max 3 |
| `sent_at` | TEXT | nullable |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

---

### `sms_logs`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `notification_id` | UUID FK → notifications | |
| `twilio_sid` | VARCHAR | nullable |
| `recipient_phone` | VARCHAR 20 | |
| `status` | ENUM | `queued`, `sent`, `delivered`, `failed`, `undelivered` |
| `error_code` | VARCHAR | nullable |
| `error_message` | TEXT | nullable |
| `attempt_number` | INTEGER | |
| `created_at` | TEXT | |

---

### `evacuations`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `incident_id` | UUID FK → incidents | |
| `initiated_by` | UUID FK → users | |
| `started_at` | TEXT | |
| `completed_at` | TEXT | nullable |
| `notes` | TEXT | nullable |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

---

### `firefighter_acknowledgements`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `incident_id` | UUID FK → incidents | |
| `user_id` | UUID FK → users | |
| `acknowledged_at` | TEXT | |
| `notes` | TEXT | nullable |
| `created_at` | TEXT | |

---

### `audit_logs`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | nullable (null = system action) |
| `action` | VARCHAR 255 | e.g., `incident.acknowledged`, `sensor.offline` |
| `entity_type` | VARCHAR 100 | nullable, e.g., `incident`, `sensor` |
| `entity_id` | UUID | nullable |
| `old_values` | TEXT | nullable, JSON string |
| `new_values` | TEXT | nullable, JSON string |
| `ip_address` | VARCHAR 45 | nullable |
| `user_agent` | VARCHAR 500 | nullable |
| `created_at` | TEXT | |

> Audit logs bersifat **immutable** — tidak ada UPDATE atau DELETE pada tabel ini.

---

## 3. Enum Values

```typescript
// Sensor
type SensorType   = 'smoke' | 'water_flow' | 'combined';
type SensorStatus = 'online' | 'offline' | 'unknown';

// Classification
type Classification = 'normal' | 'warning' | 'danger';

// Incident
type IncidentStatus =
  | 'warning' | 'danger' | 'acknowledged'
  | 'evacuation_started' | 'in_progress'
  | 'resolved' | 'closed' | 'dismissed' | 'normal';
type IncidentSeverity = 'warning' | 'danger';

// Notification
type NotificationType   = 'sms' | 'in_app';
type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retrying';

// SMS Log
type SmsStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
```

---

## 4. Redis Cache Structure

| Redis Key Pattern | Tujuan | TTL |
|------------------|--------|-----|
| `blazewatch:sensor_status:{sensor_id}` | Cache status sensor terkini | - |
| `blazewatch:sensor_seen:{sensor_code}:{timestamp_unix}` | Idempotency — duplikat reading | 300 detik |
| `blazewatch:dashboard:summary` | Cache dashboard stats | 30 detik |
| `blazewatch:jwt_blacklist:{jti}` | JWT blacklist saat logout | 15 menit (= JWT TTL) |
| `user:{id}:refresh_token` | Hash SHA-256 refresh token | 7 hari |

**Konfigurasi Redis:**  
- `appendonly yes` — persistensi aktif agar queue tidak hilang saat restart
- Single instance untuk cache, queue (BullMQ), dan session management

---

## 5. Migration Files

| File | Tabel |
|------|-------|
| `20260611_001_create_roles_table.ts` | `roles` |
| `20260611_002_create_users_table.ts` | `users` |
| `20260611_003_create_buildings_table.ts` | `buildings` |
| `20260611_004_create_zones_table.ts` | `zones` |
| `20260611_005_create_sensors_table.ts` | `sensors` |
| `20260611_006_create_sensor_readings_table.ts` | `sensor_readings` |
| `20260611_007_create_incidents_table.ts` | `incidents` |
| `20260611_008_create_incident_statuses_table.ts` | `incident_statuses` |
| `20260611_009_create_notifications_table.ts` | `notifications` |
| `20260611_010_create_sms_logs_table.ts` | `sms_logs` |
| `20260611_011_create_evacuations_table.ts` | `evacuations` |
| `20260611_012_create_firefighter_acknowledgements_table.ts` | `firefighter_acknowledgements` |
| `20260611_013_create_audit_logs_table.ts` | `audit_logs` |

---

## 6. Seed Data (Demo)

| Seeder | Data |
|--------|------|
| `01_roles.ts` | 3 roles: `admin`, `building_manager`, `firefighter` |
| `02_users.ts` | 1 admin, 1 building_manager, 1 firefighter (bcrypt passwords) |
| `03_building_zone_sensor.ts` | 1 building, 2 zones, 3 sensors |
