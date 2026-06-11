import { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { dashboardController } from '../controllers/dashboard.controller';

const router = Router();

/**
 * GET /api/v1/dashboard/summary
 * Aggregated dashboard statistics (sensor counts, active incidents, etc.).
 * Results are Redis-cached for 30 seconds.
 * Accessible by all authenticated users.
 */
router.get('/summary', authMiddleware, dashboardController.summary);

/**
 * GET /api/v1/dashboard/sensor-status
 * All active sensors with current status, zone name, and last_seen_at.
 * Accessible by all authenticated users.
 */
router.get('/sensor-status', authMiddleware, dashboardController.sensorStatus);

/**
 * GET /api/v1/dashboard/active-incidents
 * Paginated active incidents with building/zone/sensor details.
 * Accessible by all authenticated users.
 */
router.get('/active-incidents', authMiddleware, dashboardController.activeIncidents);

export default router;
