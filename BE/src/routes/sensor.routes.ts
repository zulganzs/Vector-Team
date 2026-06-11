import { Router } from 'express';

import { sensorApiKeyMiddleware } from '../middleware/sensorApiKeyMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { sensorController } from '../controllers/sensor.controller';

const router = Router();

/**
 * POST /api/v1/sensors/data
 * Ingest a sensor reading submitted over HTTP.
 *
 * - Authenticated via `X-Sensor-API-Key` header
 * - Subject to the general rate limiter (60 req/min)
 */
router.post('/data', sensorApiKeyMiddleware, generalLimiter, sensorController.ingestData);

export default router;
