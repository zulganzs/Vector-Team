import { redisClient } from '../config/redis';

/**
 * Idempotency service for sensor readings.
 *
 * Uses Redis keys `blazewatch:sensor_seen:{sensor_code}:{timestamp_unix}`
 * with a TTL of 300 seconds (5 minutes) to detect duplicate readings.
 */

/** TTL for idempotency keys — 5 minutes */
const IDEMPOTENCY_TTL_SECONDS = 300;

/**
 * Build the Redis key for a sensor + timestamp pair.
 */
function buildKey(sensorCode: string, timestampUnix: number): string {
  return `blazewatch:sensor_seen:${sensorCode}:${timestampUnix}`;
}

/**
 * Check whether a reading for the given sensor + timestamp has already been processed
 * within the last 5 minutes.
 *
 * @param sensorCode   - The sensor's unique code (e.g. "sensor-001")
 * @param timestampUnix - Unix timestamp (seconds) of the reading
 * @returns `true` if a duplicate exists, `false` otherwise
 */
async function isDuplicate(sensorCode: string, timestampUnix: number): Promise<boolean> {
  const key = buildKey(sensorCode, timestampUnix);
  const value = await redisClient.get(key);
  return value !== null;
}

/**
 * Mark a sensor reading as seen.
 * Sets the Redis key with a TTL of 300 seconds so subsequent identical readings
 * within the window are flagged as duplicates.
 *
 * @param sensorCode   - The sensor's unique code
 * @param timestampUnix - Unix timestamp (seconds) of the reading
 */
async function markSeen(sensorCode: string, timestampUnix: number): Promise<void> {
  const key = buildKey(sensorCode, timestampUnix);
  await redisClient.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS);
}

export const idempotencyService = {
  isDuplicate,
  markSeen,
};
