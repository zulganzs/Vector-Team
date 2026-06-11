import http from 'http';
import cron from 'node-cron';
import app from './app';
import { checkSensorStatusJob, autoCloseResolvedIncidents } from './jobs/checkSensorStatusJob';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

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

export default server;
