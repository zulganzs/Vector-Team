import { redisClient } from '../config/redis';
import { sensorRepository } from '../repositories/sensorRepository';
import { auditLogRepository } from '../repositories/auditLogRepository';
import { realtimeService } from '../services/realtimeService';
import { incidentService } from '../services/incidentService';
import { incidentRepository } from '../repositories/incidentRepository';
import { SensorStatus, IncidentStatus } from '../types/enums';
import { env } from '../config/env';

import type { Sensor } from '../types/domain.types';

/**
 * Check for sensors that have gone offline.
 *
 * A sensor is considered offline if it has not sent data in
 * `SENSOR_OFFLINE_THRESHOLD_SECONDS` seconds (default: 60).
 *
 * Called by node-cron every 30 seconds.
 */
export async function checkSensorStatusJob(): Promise<void> {
  console.log('[CheckSensorStatusJob] Running sensor offline detection...');

  const thresholdSeconds = env.SENSOR_OFFLINE_THRESHOLD_SECONDS;

  try {
    // Find active sensors not already offline that haven't been seen within threshold
    const staleSensors = await sensorRepository.findOfflineSensors(thresholdSeconds);

    if (staleSensors.length === 0) {
      return;
    }

    console.log(
      `[CheckSensorStatusJob] Found ${staleSensors.length} sensor(s) to mark offline.`,
    );

    for (const sensor of staleSensors) {
      try {
        // Update sensor status to offline in DB
        await sensorRepository.updateStatus(sensor.id, SensorStatus.OFFLINE, sensor.last_seen_at ?? undefined);

        // Update Redis cache: blazewatch:sensor_status:{sensor_id}
        try {
          await redisClient.set(
            `blazewatch:sensor_status:${sensor.id}`,
            JSON.stringify({ status: SensorStatus.OFFLINE, last_seen_at: sensor.last_seen_at ?? null }),
            'EX',
            120, // 2 minute cache TTL
          );
        } catch (cacheErr) {
          console.warn(
            `[CheckSensorStatusJob] Failed to update Redis cache for sensor ${sensor.id}:`,
            cacheErr,
          );
        }

        // Emit real-time sensor.offline event
        const updatedSensor: Sensor = { ...sensor, status: SensorStatus.OFFLINE };
        realtimeService.emitSensorOffline(updatedSensor);

        // Create audit log entry (fire-and-forget)
        try {
          await auditLogRepository.create({
            user_id: null,
            action: 'sensor.offline',
            entity_type: 'sensor',
            entity_id: sensor.id,
            old_values: null,
            new_values: JSON.stringify({
              sensor_id: sensor.id,
              sensor_code: sensor.sensor_code,
              zone_id: sensor.zone_id,
              last_seen_at: sensor.last_seen_at ?? null,
              status: SensorStatus.OFFLINE,
            }),
            ip_address: null,
            user_agent: null,
          });
        } catch (auditErr) {
          console.warn(
            `[CheckSensorStatusJob] Failed to create audit log for sensor ${sensor.id}:`,
            auditErr,
          );
        }

        console.log(
          `[CheckSensorStatusJob] Sensor ${sensor.sensor_code} (${sensor.id}) marked offline.`,
        );
      } catch (sensorErr) {
        console.error(
          `[CheckSensorStatusJob] Failed to mark sensor ${sensor.id} offline:`,
          sensorErr,
        );
      }
    }
  } catch (err) {
    console.error('[CheckSensorStatusJob] Unexpected error during sensor status check:', err);
  }
}

/**
 * Auto-close incidents that have been in RESOLVED status for more than 24 hours.
 *
 * Called by node-cron every hour.
 */
export async function autoCloseResolvedIncidents(): Promise<void> {
  try {
    const resolvedIncidents = await incidentRepository.findResolvedOlderThan(24);

    if (resolvedIncidents.length === 0) {
      return;
    }

    console.log(
      `[AutoCloseJob] Found ${resolvedIncidents.length} resolved incident(s) older than 24 hours. Auto-closing...`,
    );

    let closedCount = 0;

    for (const incident of resolvedIncidents) {
      try {
        await incidentService.transitionStatus(
          incident.id,
          IncidentStatus.CLOSED,
          null,
          null,
          'Auto-closed by system after 24 hours',
        );
        closedCount++;
      } catch (err) {
        console.error(
          `[AutoCloseJob] Failed to auto-close incident ${incident.id}:`,
          err,
        );
      }
    }

    console.log(`[AutoCloseJob] Auto-closed ${closedCount} incident(s).`);
  } catch (err) {
    console.error('[AutoCloseJob] Unexpected error during auto-close job:', err);
  }
}
