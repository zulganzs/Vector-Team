import http from 'http';
import cron from 'node-cron';
import app from './app';
import { db } from './config/database';
import { redisClient } from './config/redis';
import { checkSensorStatusJob, autoCloseResolvedIncidents } from './jobs/checkSensorStatusJob';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

/**
 * Bootstrap function: run DB migrations, then start the HTTP server.
 */
async function bootstrap(): Promise<void> {
  // Run pending migrations before accepting traffic
  console.log('[Server] Running database migrations...');
  await db.migrate.latest();
  console.log('[Server] Database migrations complete.');

  server.listen(PORT, () => {
    console.log(`[Server] BlazeWatch API running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

    // Schedule sensor offline detection every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      console.log('[Cron] checkSensorStatusJob triggered');
      await checkSensorStatusJob();
    });
    console.log('[Server] Cron job scheduled: checkSensorStatusJob every 30 seconds');

    // Schedule auto-close of resolved incidents every hour
    cron.schedule('0 * * * *', async () => {
      console.log('[Cron] autoCloseResolvedIncidents triggered');
      await autoCloseResolvedIncidents();
    });
    console.log('[Server] Cron job scheduled: autoCloseResolvedIncidents every hour');
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  server.close(async () => {
    console.log('[Server] HTTP server closed');
    try {
      await redisClient.quit();
      console.log('[Server] Redis connection closed');
    } catch (err) {
      console.error('[Server] Error closing Redis connection:', err);
    }
    try {
      await db.destroy();
      console.log('[Server] Database connection destroyed');
    } catch (err) {
      console.error('[Server] Error destroying database connection:', err);
    }
    process.exit(0);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

export default server;
