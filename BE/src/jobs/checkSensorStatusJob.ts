import { db } from '../config/database';
import { sensorRepository } from '../repositories/sensorRepository';
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
  const thresholdSeconds = env.SENSOR_OFFLINE_THRESHOLD_SECONDS;
  const cutoffTime = new Date(
    Date.now() - thresholdSeconds * 1000,
  ).toISOString();

  try {
    // Find sensors that were online but haven't been seen since the cutoff
    const staleSensors = await db<Sensor>('sensors')
      .where('status', SensorStatus.ONLINE)
      .where('is_active', true)
      .where(function () {
        this.whereNull('last_seen_at').orWhere('last_seen_at', '<', cutoffTime);
      });

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

        // Emit real-time event
        const updatedSensor: Sensor = { ...sensor, status: SensorStatus.OFFLINE };
        realtimeService.emitSensorOffline(updatedSensor);

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
 * Called by node-cron (recommended: every hour or daily).
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
