import type { SensorReading, Sensor, Incident, Notification } from '../types/domain.types';

/**
 * Real-Time Event Service — STUB
 *
 * This file is a minimal stub created for Task 4 (IoT Sensor Data Ingestion).
 * Full implementation with Socket.IO will be provided in Task 7 (Real-Time WebSocket).
 *
 * All methods are no-ops that log a placeholder message.
 * The function signatures are intentionally compatible with the final implementation
 * so no call-site changes will be required.
 */

/** Initialise the Socket.IO instance (called by websocket-server entry point). */
function initialize(_io: unknown): void {
  // Stub — full implementation in Task 7
}

/** Emit a raw event with an optional payload. */
function emit(_event: string, _payload?: unknown): void {
  // Stub — full implementation in Task 7
}

/** Emit `sensor.update` when a new reading is processed. */
function emitSensorUpdate(_reading: SensorReading): void {
  // Stub — full implementation in Task 7
}

/** Emit `sensor.offline` when a sensor goes offline. */
function emitSensorOffline(_sensor: Sensor): void {
  // Stub — full implementation in Task 7
}

/** Emit `sensor.online` when a sensor comes back online. */
function emitSensorOnline(_sensor: Sensor): void {
  // Stub — full implementation in Task 7
}

/** Emit `incident.created` when a new incident is detected. */
function emitIncidentCreated(_incident: Incident): void {
  // Stub — full implementation in Task 7
}

/** Emit `incident.updated` when an incident status changes. */
function emitIncidentUpdated(_incident: Incident): void {
  // Stub — full implementation in Task 7
}

/** Emit `notification.sent` after an SMS is dispatched. */
function emitNotificationSent(_notification: Notification): void {
  // Stub — full implementation in Task 7
}

/** Emit an event scoped to a specific building channel. */
function emitToBuilding(_buildingId: string, _event: string, _payload?: unknown): void {
  // Stub — full implementation in Task 7
}

export const realtimeService = {
  initialize,
  emit,
  emitSensorUpdate,
  emitSensorOffline,
  emitSensorOnline,
  emitIncidentCreated,
  emitIncidentUpdated,
  emitNotificationSent,
  emitToBuilding,
};
