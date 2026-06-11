import { redisClient } from '../config/redis';
import { sensorRepository } from '../repositories/sensorRepository';
import { sensorReadingRepository } from '../repositories/sensorReadingRepository';
import { idempotencyService } from './idempotencyService';
import { sensorClassificationService } from './sensorClassificationService';
import { realtimeService } from './realtimeService';
import { incidentService } from './incidentService';

import type { SensorReading } from '../types/domain.types';
import type { SensorDataInput } from '../schemas/sensorDataSchema';
import { SensorStatus } from '../types/enums';

import { NotFoundError } from '../errors/NotFoundError';
import { AppError } from '../errors/AppError';

/**
 * Result returned by `processReading`.
 */
export interface ProcessReadingResult {
  reading: SensorReading;
  classification: string;
  is_duplicate: boolean;
}

/**
 * Sensor Processing Service
 *
 * Orchestrates the full pipeline for a single sensor data reading:
 * 1. Validate sensor exists and is active
 * 2. Idempotency check (duplicate detection within 5 min window)
 * 3. Classify smoke value
 * 4. Persist sensor_reading record
 * 5. Update sensor status (online) in DB + Redis cache
 * 6. Emit real-time sensor.update event
 * 7. Trigger incident evaluation (if not duplicate)
 */

/**
 * Process a validated sensor data payload end-to-end.
 *
 * @param payload - Validated `SensorDataInput` from the Zod schema
 * @returns The persisted `SensorReading` record, classification, and duplicate flag
 * @throws NotFoundError (404) if sensor is not found
 * @throws AppError (403) if sensor is inactive
 */
async function processReading(payload: SensorDataInput): Promise<ProcessReadingResult> {
  const { sensor_id: sensorCode, smoke_value, water_flow, timestamp } = payload;

  // ── 1. Validate sensor exists and is active ────────────────────────────────
  const sensor = await sensorRepository.findByCode(sensorCode);
  if (!sensor) {
    throw new NotFoundError(`Sensor with code '${sensorCode}' not found`, 'SENSOR_NOT_FOUND');
  }
  if (!sensor.is_active) {
    throw new AppError(`Sensor '${sensorCode}' is inactive`, 403, 'SENSOR_INACTIVE');
  }

  // ── 2. Idempotency check ──────────────────────────────────────────────────
  const timestampUnix = Math.floor(new Date(timestamp).getTime() / 1000);
  const isDuplicate = await idempotencyService.isDuplicate(sensorCode, timestampUnix);

  // ── 3. Classify smoke value ───────────────────────────────────────────────
  const classification = sensorClassificationService.classify(smoke_value);

  // ── 4. Persist sensor reading ─────────────────────────────────────────────
  const reading = await sensorReadingRepository.create({
    sensor_id: sensor.id,
    zone_id: sensor.zone_id,
    smoke_value,
    water_flow: water_flow ?? null,
    classification,
    is_duplicate: isDuplicate,
    sensor_timestamp: timestamp,
    received_at: new Date().toISOString(),
  });

  // ── 5. Mark as seen (idempotency) if not already a duplicate ─────────────
  if (!isDuplicate) {
    await idempotencyService.markSeen(sensorCode, timestampUnix);
  }

  // ── 6. Update sensor status: online + last_seen_at in DB ─────────────────
  const now = new Date().toISOString();
  await sensorRepository.updateStatus(sensor.id, SensorStatus.ONLINE, now);

  // Update Redis cache: blazewatch:sensor_status:{sensor_id}
  try {
    await redisClient.set(
      `blazewatch:sensor_status:${sensor.id}`,
      JSON.stringify({ status: SensorStatus.ONLINE, last_seen_at: now }),
      'EX',
      120, // 2 minute cache TTL
    );
  } catch (cacheErr) {
    // Non-fatal — log and continue
    console.warn('[SensorProcessingService] Failed to update Redis sensor status cache:', cacheErr);
  }

  // ── 7. Emit real-time sensor.update event ─────────────────────────────────
  try {
    realtimeService.emitSensorUpdate(reading);
  } catch (realtimeErr) {
    console.warn('[SensorProcessingService] realtimeService.emitSensorUpdate failed:', realtimeErr);
  }

  // Task 8.2: emit sensor.online on recovery from offline state
  // if (previousStatus === SensorStatus.OFFLINE) {
  //   realtimeService.emitSensorOnline(updatedSensor);
  // }

  // ── 8. Trigger incident evaluation (non-duplicate readings only) ──────────
  if (!isDuplicate) {
    try {
      await incidentService.evaluateSensorReading(reading);
    } catch (incidentErr) {
      console.warn('[SensorProcessingService] incidentService.evaluateSensorReading failed:', incidentErr);
    }
  }

  return {
    reading,
    classification,
    is_duplicate: isDuplicate,
  };
}

export const sensorProcessingService = {
  processReading,
};
