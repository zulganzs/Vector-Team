import { randomUUID } from 'crypto';

import { incidentRepository } from '../repositories/incidentRepository';
import { auditLogRepository } from '../repositories/auditLogRepository';
import { realtimeService } from './realtimeService';
import { notificationService } from './notificationService';

import { InvalidIncidentTransitionError } from '../errors/InvalidIncidentTransitionError';
import { NotFoundError } from '../errors/NotFoundError';

import type { Incident, IncidentStatus as IncidentStatusRow, SensorReading } from '../types/domain.types';
import { IncidentStatus, Classification } from '../types/enums';
import { db } from '../config/database';

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Allowed status transitions for the incident state machine.
 * Key = current status, value = set of valid next statuses.
 */
const ALLOWED_TRANSITIONS: Record<string, IncidentStatus[]> = {
  [IncidentStatus.WARNING]: [
    IncidentStatus.DANGER,
    IncidentStatus.ACKNOWLEDGED,
    IncidentStatus.DISMISSED,
    IncidentStatus.NORMAL,
  ],
  [IncidentStatus.DANGER]: [
    IncidentStatus.ACKNOWLEDGED,
    IncidentStatus.DISMISSED,
  ],
  [IncidentStatus.ACKNOWLEDGED]: [
    IncidentStatus.EVACUATION_STARTED,
    IncidentStatus.IN_PROGRESS,
    IncidentStatus.RESOLVED,
    IncidentStatus.DISMISSED,
  ],
  [IncidentStatus.EVACUATION_STARTED]: [
    IncidentStatus.IN_PROGRESS,
    IncidentStatus.RESOLVED,
    IncidentStatus.DISMISSED,
  ],
  [IncidentStatus.IN_PROGRESS]: [
    IncidentStatus.RESOLVED,
    IncidentStatus.DISMISSED,
  ],
  [IncidentStatus.RESOLVED]: [IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [],
  [IncidentStatus.DISMISSED]: [],
  [IncidentStatus.NORMAL]: [],
};

/**
 * Roles permitted to perform each status transition.
 */
const TRANSITION_ROLE_MAP: Record<string, string[]> = {
  [IncidentStatus.DISMISSED]: ['building_manager', 'admin'],
  [IncidentStatus.ACKNOWLEDGED]: ['firefighter', 'admin'],
  [IncidentStatus.EVACUATION_STARTED]: ['building_manager', 'admin'],
  [IncidentStatus.IN_PROGRESS]: ['firefighter', 'admin'],
  [IncidentStatus.RESOLVED]: ['firefighter', 'admin'],
  [IncidentStatus.CLOSED]: ['building_manager', 'admin'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Persist a record in `incident_statuses` table.
 * Wraps in try/catch — failure here is non-fatal.
 */
async function createIncidentStatusRecord(
  incidentId: string,
  fromStatus: string | null,
  toStatus: string,
  actorId: string | null,
  reason?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const record: IncidentStatusRow = {
    id: randomUUID(),
    incident_id: incidentId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    reason: reason ?? null,
    created_at: now,
  };
  try {
    await db<IncidentStatusRow>('incident_statuses').insert(record);
  } catch (err) {
    console.warn('[IncidentService] Failed to create incident_statuses record:', err);
  }
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
async function writeAuditLog(
  action: string,
  entityId: string,
  actorId: string | null,
  oldValues?: object,
  newValues?: object,
): Promise<void> {
  try {
    await auditLogRepository.create({
      user_id: actorId,
      action,
      entity_type: 'incident',
      entity_id: entityId,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      ip_address: null,
      user_agent: null,
    });
  } catch (err) {
    console.warn('[IncidentService] Failed to write audit log:', err);
  }
}

// ─── 5.2: createIncident ──────────────────────────────────────────────────────

/**
 * Create a new incident, seed the incident_statuses history, emit real-time event,
 * write audit log, and (if DANGER) dispatch SMS notification.
 */
async function createIncident(
  data: Omit<Incident, 'id' | 'created_at' | 'updated_at'>,
): Promise<Incident> {
  const incident = await incidentRepository.create(data);

  // Seed initial incident_statuses record (no from_status for creation)
  await createIncidentStatusRecord(incident.id, null, incident.status, null);

  // Emit real-time event
  try {
    realtimeService.emitIncidentCreated(incident);
  } catch (err) {
    console.warn('[IncidentService] realtimeService.emitIncidentCreated failed:', err);
  }

  // Audit log
  await writeAuditLog('incident.created', incident.id, null, undefined, {
    status: incident.status,
    severity: incident.severity,
    sensor_id: incident.sensor_id,
  });

  // Dispatch SMS if severity is DANGER
  if (incident.severity === 'danger') {
    try {
      await notificationService.dispatchSmsForIncident(incident);
    } catch (err) {
      console.warn('[IncidentService] notificationService.dispatchSmsForIncident failed:', err);
    }
  }

  return incident;
}

// ─── 5.1: evaluateSensorReading ───────────────────────────────────────────────

/**
 * Evaluate a sensor reading and create/update an incident if necessary.
 *
 * Business rules:
 * - WARNING/DANGER and no active incident → create new incident
 * - Active WARNING incident + classification normal → auto-resolve to NORMAL
 * - Active WARNING incident + new reading is DANGER → escalate to DANGER
 */
async function evaluateSensorReading(reading: SensorReading): Promise<void> {
  const { sensor_id, zone_id, smoke_value, water_flow, classification, sensor_timestamp } = reading;

  // Query active incident for this sensor
  const activeIncident = await incidentRepository.findActiveForSensor(sensor_id);

  // Derive zone's building_id — need to JOIN through sensors → zones → buildings
  // We use the zone_id from the reading (denormalised) to look up building_id
  const zoneRow = await db('zones').where({ id: zone_id }).select('building_id').first() as { building_id: string } | undefined;
  const buildingId = zoneRow?.building_id ?? '';

  if (!activeIncident) {
    // No active incident — create one if WARNING or DANGER
    if (
      classification === Classification.WARNING ||
      classification === Classification.DANGER
    ) {
      const status = classification as unknown as Incident['status'];
      const severity = classification as unknown as Incident['severity'];
      await createIncident({
        sensor_id,
        zone_id,
        building_id: buildingId,
        status,
        severity,
        smoke_value,
        water_flow: water_flow ?? null,
        notes: null,
        detected_at: sensor_timestamp,
        acknowledged_at: null,
        resolved_at: null,
        closed_at: null,
        dismissed_at: null,
      });
    }
    // NORMAL → nothing to do
    return;
  }

  // Active incident exists — evaluate transitions
  if (
    activeIncident.status === IncidentStatus.WARNING &&
    classification === Classification.NORMAL
  ) {
    // Auto-resolve: WARNING → NORMAL (only when still in WARNING state, not yet acknowledged)
    await transitionStatus(activeIncident.id, IncidentStatus.NORMAL, null);
    return;
  }

  if (
    activeIncident.status === IncidentStatus.WARNING &&
    classification === Classification.DANGER
  ) {
    // Escalate: WARNING → DANGER
    await transitionStatus(activeIncident.id, IncidentStatus.DANGER, null);
    return;
  }

  // All other cases (duplicate danger, danger→acknowledged already, etc.) — no-op
}

// ─── 5.3: transitionStatus ────────────────────────────────────────────────────

/**
 * Transition an incident to a new status.
 *
 * @param incidentId  - UUID of the incident
 * @param toStatus    - Target status
 * @param actorUserId - UUID of the acting user, or null for system actions
 * @param actorRole   - Role of the acting user (used for role validation). Pass null for system.
 * @param reason      - Optional human-readable reason / notes
 */
async function transitionStatus(
  incidentId: string,
  toStatus: IncidentStatus,
  actorUserId: string | null,
  actorRole?: string | null,
  reason?: string | null,
): Promise<Incident> {
  // Fetch current incident
  const incident = await incidentRepository.findById(incidentId);
  if (!incident) {
    throw new NotFoundError(`Incident '${incidentId}' not found`, 'INCIDENT_NOT_FOUND');
  }

  const fromStatus = incident.status;

  // Validate transition
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new InvalidIncidentTransitionError(fromStatus, toStatus);
  }

  // Validate actor role (skip for system/null actor)
  if (actorUserId !== null && actorRole) {
    const permittedRoles = TRANSITION_ROLE_MAP[toStatus];
    if (permittedRoles && !permittedRoles.includes(actorRole)) {
      const { AuthorizationError } = await import('../errors/AuthorizationError');
      throw new AuthorizationError(
        `Role '${actorRole}' is not permitted to perform this transition`,
        'FORBIDDEN',
      );
    }
  }

  // Build timestamp updates
  const now = new Date().toISOString();
  const updates: Partial<Incident> = { status: toStatus };

  switch (toStatus) {
    case IncidentStatus.ACKNOWLEDGED:
      updates.acknowledged_at = now;
      break;
    case IncidentStatus.RESOLVED:
    case IncidentStatus.NORMAL:
      updates.resolved_at = now;
      break;
    case IncidentStatus.CLOSED:
      updates.closed_at = now;
      break;
    case IncidentStatus.DISMISSED:
      updates.dismissed_at = now;
      if (reason) updates.notes = reason;
      break;
    case IncidentStatus.DANGER:
      // Escalation — also update severity
      updates.severity = 'danger';
      break;
    default:
      break;
  }

  const updated = await incidentRepository.updateStatus(incidentId, updates);

  // Create incident_statuses record
  await createIncidentStatusRecord(incidentId, fromStatus, toStatus, actorUserId, reason);

  // Audit log
  await writeAuditLog(
    'incident.status_changed',
    incidentId,
    actorUserId,
    { status: fromStatus },
    { status: toStatus, ...updates },
  );

  // Emit real-time event
  try {
    realtimeService.emitIncidentUpdated(updated);
  } catch (err) {
    console.warn('[IncidentService] realtimeService.emitIncidentUpdated failed:', err);
  }

  // If transitioning to DANGER, dispatch SMS
  if (toStatus === IncidentStatus.DANGER) {
    try {
      await notificationService.dispatchSmsForIncident(updated);
    } catch (err) {
      console.warn('[IncidentService] dispatchSmsForIncident failed on DANGER escalation:', err);
    }
  }

  return updated;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const incidentService = {
  evaluateSensorReading,
  createIncident,
  transitionStatus,
};
