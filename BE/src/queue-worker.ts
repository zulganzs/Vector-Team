/**
 * BlazeWatch — BullMQ Queue Worker Entry Point
 *
 * This is a standalone long-running process that consumes jobs from the
 * `sms` BullMQ queue and dispatches SMS messages via Twilio.
 *
 * Run via: node dist/queue-worker.js
 * Docker: worker container — `node dist/queue-worker.js`
 *
 * This file must NEVER be imported by server.ts or any other entry point.
 */

// 1. Node.js built-ins
// (none)

// 2. Third-party libraries
import Redis from 'ioredis';
import { Worker } from 'bullmq';

// 3. Internal config
import { env } from './config/env';

// 4. Jobs
import { sendSmsProcessor } from './jobs/sendSmsJob';

// ─── Redis Connection ──────────────────────────────────────────────────────────

/**
 * Dedicated Redis connection for the worker process.
 *
 * BullMQ requires a connection with `maxRetriesPerRequest: null`
 * (blocking commands are used internally by the Worker).
 */
const workerRedis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // Required for BullMQ Worker
  enableReadyCheck: false,
  retryStrategy: (times: number): number | null => {
    if (times > 10) return null;
    return Math.min(50 * Math.pow(2, times - 1), 5000);
  },
});

workerRedis.on('connect', () => {
  console.log(`[QueueWorker] Redis connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

workerRedis.on('error', (err: Error) => {
  console.error('[QueueWorker] Redis error:', err.message);
});

// ─── BullMQ Worker ─────────────────────────────────────────────────────────────

const worker = new Worker('sms', sendSmsProcessor, {
  connection: workerRedis,
  concurrency: 5, // process up to 5 SMS jobs in parallel
});

worker.on('active', (job) => {
  console.log(`[QueueWorker] Job ${job.id} active — notification ${job.data.notificationId}`);
});

worker.on('completed', (job) => {
  console.log(`[QueueWorker] Job ${job.id} completed — notification ${job.data.notificationId}`);
});

worker.on('failed', (job, err) => {
  const attempts = job?.attemptsMade ?? '?';
  const notifId = job?.data?.notificationId ?? 'unknown';
  console.error(
    `[QueueWorker] Job ${job?.id} failed (attempt ${attempts}) for notification ${notifId}: ${err.message}`,
  );
});

worker.on('error', (err) => {
  console.error('[QueueWorker] Worker error:', err);
});

console.log('[QueueWorker] BullMQ worker started — listening on queue: sms');

// ─── Graceful Shutdown ──────────────────────────────────────────────────────────

/**
 * Gracefully shut down the worker on SIGTERM.
 *
 * 1. Stop accepting new jobs (worker.close() waits for active jobs to complete).
 * 2. Disconnect Redis.
 */
async function shutdown(): Promise<void> {
  console.log('[QueueWorker] SIGTERM received — shutting down gracefully...');

  try {
    // Close worker — waits for currently active jobs to finish
    await worker.close();
    console.log('[QueueWorker] Worker closed.');
  } catch (err) {
    console.error('[QueueWorker] Error closing worker:', err);
  }

  try {
    workerRedis.disconnect();
    console.log('[QueueWorker] Redis disconnected.');
  } catch (err) {
    console.error('[QueueWorker] Error disconnecting Redis:', err);
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown); // also handle Ctrl+C in development
