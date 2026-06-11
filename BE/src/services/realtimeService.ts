import type { Server } from 'socket.io';
import type { SensorReading, Sensor, Incident, Notification } from '../types/domain.types';

/**
 * Real-Time Event Service — Socket.IO Singleton
 *
 * Module-level singleton that wraps the Socket.IO server instance.
 * Call `initialize(io)` once at startup from `websocket-server.ts` before
 * any other method is used.
 *
 * All public methods are wrapped in try/catch and will never throw to caller.
 */

let io: Server | null = null;

/**
 * Store the Socket.IO server instance. Must be called once at startup.
 *
 * @param ioInstance - Configured Socket.IO Server instance
 */
function initialize(ioInstance: Server): void {
  io = ioInstance;
}

/**
 * Broadcast a raw event with an optional payload to ALL connected clients.
 * Logs a warning if the service has not been initialized yet.
 *
 * @param event   - Socket.IO event name (e.g. `sensor.update`)
 * @param payload - Optional data to send with the event
 */
function emit(event: string, payload?: unknown): void {
  try {
    if (!io) {
      console.warn(`[realtimeService] emit("${event}") called before initialize() — skipping`);
      return;
    }
    io.emit(event, payload);
  } catch (err) {
    console.error(`[realtimeService] Failed to emit event "${event}":`, err);
  }
}

/**
 * Emit an event scoped to a specific building room.
 * Clients must join room `building:{buildingId}` to receive these events.
 *
 * @param buildingId - UUID of the target building
 * @param event      - Socket.IO event name
 * @param payload    - Optional data to send with the event
 */
function emitToBuilding(buildingId: string, event: string, payload?: unknown): void {
  try {
    if (!io) {
      console.warn(
        `[realtimeService] emitToBuilding("${buildingId}", "${event}") called before initialize() — skipping`,
      );
      return;
    }
    io.to(`building:${buildingId}`).emit(event, payload);
  } catch (err) {
    console.error(
      `[realtimeService] Failed to emit event "${event}" to building "${buildingId}":`,
      err,
    );
  }
}

/**
 * Broadcast a new sensor reading to all connected clients.
 * Event: `sensor.update`
 *
 * @param reading - The SensorReading that was just processed
 */
function emitSensorUpdate(reading: SensorReading): void {
  try {
    emit('sensor.update', reading);
  } catch (err) {
    console.error('[realtimeService] Failed to emit sensor.update:', err);
  }
}

/**
 * Broadcast a sensor-offline event to all connected clients.
 * Event: `sensor.offline`
 *
 * @param sensor - The Sensor that went offline
 */
function emitSensorOffline(sensor: Sensor): void {
  try {
    emit('sensor.offline', sensor);
  } catch (err) {
    console.error('[realtimeService] Failed to emit sensor.offline:', err);
  }
}

/**
 * Broadcast a sensor-online event to all connected clients.
 * Event: `sensor.online`
 *
 * @param sensor - The Sensor that came back online
 */
function emitSensorOnline(sensor: Sensor): void {
  try {
    emit('sensor.online', sensor);
  } catch (err) {
    console.error('[realtimeService] Failed to emit sensor.online:', err);
  }
}

/**
 * Emit an `incident.created` event to the building room where the incident occurred.
 * Event: `incident.created`
 *
 * @param incident - The newly created Incident
 */
function emitIncidentCreated(incident: Incident): void {
  try {
    emitToBuilding(incident.building_id, 'incident.created', incident);
  } catch (err) {
    console.error('[realtimeService] Failed to emit incident.created:', err);
  }
}

/**
 * Emit an `incident.updated` event to the building room where the incident occurred.
 * Event: `incident.updated`
 *
 * @param incident - The updated Incident
 */
function emitIncidentUpdated(incident: Incident): void {
  try {
    emitToBuilding(incident.building_id, 'incident.updated', incident);
  } catch (err) {
    console.error('[realtimeService] Failed to emit incident.updated:', err);
  }
}

/**
 * Broadcast a notification-sent event to all connected clients.
 * Event: `notification.sent`
 *
 * @param notification - The Notification that was dispatched
 */
function emitNotificationSent(notification: Notification): void {
  try {
    emit('notification.sent', notification);
  } catch (err) {
    console.error('[realtimeService] Failed to emit notification.sent:', err);
  }
}

export const realtimeService = {
  initialize,
  emit,
  emitToBuilding,
  emitSensorUpdate,
  emitSensorOffline,
  emitSensorOnline,
  emitIncidentCreated,
  emitIncidentUpdated,
  emitNotificationSent,
};
