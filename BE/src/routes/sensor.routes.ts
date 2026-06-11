import { Router } from 'express';

import { sensorApiKeyMiddleware } from '../middleware/sensorApiKeyMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';
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

/**
 * GET /api/v1/sensors
 * List all active sensors with current status and zone info.
 * Accessible by all authenticated users.
 */
router.get('/', authMiddleware, sensorController.list);

/**
 * GET /api/v1/sensors/:id
 * Get sensor detail including zone, building, and latest reading.
 * Accessible by all authenticated users.
 */
router.get('/:id', authMiddleware, sensorController.show);

/**
 * GET /api/v1/sensors/:id/readings
 * Paginated reading history for a specific sensor.
 * Accessible by all authenticated users.
 */
router.get('/:id/readings', authMiddleware, sensorController.readings);

export default router;
