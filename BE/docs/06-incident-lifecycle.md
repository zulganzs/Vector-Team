# Incident Lifecycle

---

## 1. State Machine Overview

```
                    ┌─────────────────────────────────┐
                    │          FIRE DETECTED           │
                    │  smoke 300–600 → WARNING         │
                    │  smoke > 600   → DANGER          │
                    └───────────────┬─────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │        WARNING         │
                        │   (auto-created by     │
                        │    SensorProcessing)   │
                        └─────┬──────┬──────────┘
                              │      │
               smoke > 600    │      │  smoke < 300    Building Manager
               (system)       │      │  (system)       dismiss
                              ▼      ▼                 ▼
                  ┌─────────────┐ ┌────────┐    ┌──────────┐
                  │    DANGER   │ │ NORMAL │    │ DISMISSED│
                  │  (+ SMS)    │ │(closed)│    │(false    │
                  └──────┬──────┘ └────────┘    │ alarm)   │
                         │                      └──────────┘
            Firefighter   │
            acknowledge   │
                         ▼
                ┌─────────────────┐
                │  ACKNOWLEDGED   │
                └────────┬────────┘
                         │
            Building Mgr  │
            start evac    │
                         ▼
              ┌──────────────────────┐
              │  EVACUATION_STARTED  │
              └──────────┬───────────┘
                         │
            Firefighter   │
            mark en-route │
                         ▼
                ┌─────────────────┐
                │   IN_PROGRESS   │
                └────────┬────────┘
                         │
            Firefighter   │
            fire contained│
                         ▼
                ┌─────────────────┐
                │    RESOLVED     │
                └────────┬────────┘
                         │
          Building Mgr   │  OR auto-close
          close OR        │  24h after RESOLVED
          system auto-close│  (scheduled job)
                         ▼
                ┌─────────────────┐
                │     CLOSED      │
                └─────────────────┘
```

---

## 2. Status Transition Table

| From | To | Actor | Condition |
|------|----|-------|-----------|
| `warning` | `danger` | System | `smoke_value > DANGER_THRESHOLD` |
| `warning` | `normal` | System | `smoke_value < WARNING_THRESHOLD` |
| `warning` | `dismissed` | Building Manager / Admin | Manual false alarm |
| `danger` | `acknowledged` | Firefighter / Admin | Manual acknowledge |
| `danger` | `dismissed` | Building Manager / Admin | Manual false alarm |
| `acknowledged` | `evacuation_started` | Building Manager / Admin | Start evacuation |
| `evacuation_started` | `in_progress` | Firefighter / Admin | En route confirmed |
| `in_progress` | `resolved` | Firefighter / Admin | Fire contained |
| `resolved` | `closed` | Building Manager / Admin / System | Manual close or 24h auto-close |

---

## 3. Incident Creation Logic

```
evaluateSensorReading(sensorId, classification, smokeValue, waterFlow, timestamp)
         │
         ▼
Query active incident for this sensor
         │
    ┌────┴────────────────┐
    │ No active incident   │ Active incident exists
    ▼                      ▼
classification            Update severity if escalated
= WARNING or              (e.g., warning → danger)
= DANGER?
    │
    ▼ Yes
createIncident({
  building_id, zone_id, sensor_id,
  severity: classification,
  initial_smoke_value: smokeValue,
  detected_at: timestamp,
  status: classification   // 'warning' or 'danger'
})
    │
    ├── persist incidents table
    ├── create initial incident_statuses record
    ├── emit incident.created (WebSocket)
    ├── create AuditLog: incident.created
    └── if severity = DANGER:
        NotificationService.dispatchSmsForIncident(incident)
```

**Rule:** Hanya satu active incident per sensor pada satu waktu.

---

## 4. Auto-Resolution Rules

### Auto-Resolve to NORMAL

- **Kondisi:** Incident status = `warning` (belum di-acknowledge)
- **Trigger:** Sensor reading baru dengan `smoke_value < WARNING_THRESHOLD`
- **Aksi:** `transitionStatus(incidentId, 'normal', null, 'Auto-resolved: smoke level returned to normal')`

> **Penting:** Incident berstatus `danger` TIDAK auto-resolve. Harus melalui manual acknowledgement.

### Auto-Close to CLOSED

- **Kondisi:** Incident status = `resolved` selama > 24 jam
- **Trigger:** Scheduled cron job setiap jam: `cron.schedule('0 * * * *', autoCloseResolvedIncidents)`
- **Aksi:** `transitionStatus(incidentId, 'closed', null, 'Auto-closed: 24 hours after resolution')`

---

## 5. Incident Status History (`incident_statuses`)

Setiap transisi status menghasilkan record di tabel `incident_statuses`:

```json
{
  "id": "uuid",
  "incident_id": "uuid",
  "previous_status": "danger",
  "new_status": "acknowledged",
  "changed_by": "uuid-firefighter-user-id",
  "reason": "En route to location",
  "created_at": "2026-06-11T10:35:00.000Z"
}
```

- System actions → `changed_by: null`
- User actions → `changed_by: user_id`

---

## 6. Timestamp Fields di `incidents`

| Timestamp | Diset Saat |
|-----------|-----------|
| `detected_at` | Incident dibuat (dari sensor timestamp) |
| `acknowledged_at` | Status → `acknowledged` |
| `resolved_at` | Status → `resolved` |
| `closed_at` | Status → `closed` |
| `dismissed_at` | Status → `dismissed` |

---

## 7. API Endpoints Incident

| Method | Endpoint | Actor | Transisi |
|--------|----------|-------|---------|
| `PATCH` | `/incidents/:id/dismiss` | building_manager, admin | → `dismissed` |
| `PATCH` | `/incidents/:id/acknowledge` | firefighter, admin | → `acknowledged` |
| `PATCH` | `/incidents/:id/start-evacuation` | building_manager, admin | → `evacuation_started` |
| `PATCH` | `/incidents/:id/mark-in-progress` | firefighter, admin | → `in_progress` |
| `PATCH` | `/incidents/:id/resolve` | firefighter, admin | → `resolved` |
| `PATCH` | `/incidents/:id/close` | building_manager, admin | → `closed` |

---

## 8. transitionStatus Logic

```typescript
transitionStatus(incidentId, toStatus, actorUserId?, reason?)

1. Fetch current incident
2. Validate transition:
   current_status → toStatus in ALLOWED_TRANSITIONS map
   → if invalid: throw InvalidIncidentTransitionError (409)
3. Validate actor role matches required role for this transition
   → if unauthorized: throw AuthorizationError (403)
4. UPDATE incidents.status = toStatus
5. UPDATE relevant timestamp field
6. INSERT incident_statuses record
7. CREATE AuditLog entry
8. emit incident.updated via RealtimeService
9. if toStatus = 'danger': trigger SMS notification
```

---

## 9. Invalid Transition Response

```json
{
  "success": false,
  "message": "Cannot transition incident from 'closed' to 'warning'",
  "error_code": "INVALID_INCIDENT_TRANSITION"
}
```

HTTP Status: `409 Conflict`
