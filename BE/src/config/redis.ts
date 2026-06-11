import Redis from 'ioredis';
import { env } from './env';

/**
 * ioredis client for BlazeWatch.
 *
 * - Connects using REDIS_HOST and REDIS_PORT env vars
 * - Exponential backoff retry strategy with a maximum of 10 retries
 * - Used for: refresh token storage, JWT blacklist, idempotency keys, BullMQ queues
 */
const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  retryStrategy: (times: number): number | null => {
    const MAX_RETRIES = 10;
    if (times > MAX_RETRIES) {
      // Stop retrying after max attempts
      return null;
    }
    // Exponential backoff: 50ms, 100ms, 200ms, … capped at 5 seconds
    const delay = Math.min(50 * Math.pow(2, times - 1), 5000);
    return delay;
  },
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
  enableReadyCheck: false,    // Prevent blocking on Redis not yet ready
  lazyConnect: false,
});

redisClient.on('connect', () => {
  console.log(`[Redis] Connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redisClient.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

redisClient.on('reconnecting', () => {
  console.warn('[Redis] Reconnecting…');
});

export { redisClient };
