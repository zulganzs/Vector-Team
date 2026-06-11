import { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { incidentController } from '../controllers/incident.controller';

const router = Router();

/**
 * GET /api/v1/incidents
 * List all incidents with pagination and optional filters.
 * Accessible by all authenticated users.
 */
router.get('/', authMiddleware, incidentController.list);

/**
 * GET /api/v1/incidents/:id
 * Get a single incident by ID with building/zone/sensor enrichment.
 * Accessible by all authenticated users.
 */
router.get('/:id', authMiddleware, incidentController.show);

/**
 * PATCH /api/v1/incidents/:id/dismiss
 * Dismiss a false-alarm incident.
 * Restricted to: building_manager, admin
 */
router.patch(
  '/:id/dismiss',
  authMiddleware,
  roleMiddleware(['building_manager', 'admin']),
  incidentController.dismiss,
);

/**
 * PATCH /api/v1/incidents/:id/acknowledge
 * Acknowledge an incident (firefighter on the way).
 * Restricted to: firefighter, admin
 */
router.patch(
  '/:id/acknowledge',
  authMiddleware,
  roleMiddleware(['firefighter', 'admin']),
  incidentController.acknowledge,
);

/**
 * PATCH /api/v1/incidents/:id/start-evacuation
 * Initiate building evacuation.
 * Restricted to: building_manager, admin
 */
router.patch(
  '/:id/start-evacuation',
  authMiddleware,
  roleMiddleware(['building_manager', 'admin']),
  incidentController.startEvacuation,
);

/**
 * PATCH /api/v1/incidents/:id/mark-in-progress
 * Mark incident as actively being handled by firefighters.
 * Restricted to: firefighter, admin
 */
router.patch(
  '/:id/mark-in-progress',
  authMiddleware,
  roleMiddleware(['firefighter', 'admin']),
  incidentController.markInProgress,
);

/**
 * PATCH /api/v1/incidents/:id/resolve
 * Mark incident as resolved.
 * Restricted to: firefighter, admin
 */
router.patch(
  '/:id/resolve',
  authMiddleware,
  roleMiddleware(['firefighter', 'admin']),
  incidentController.resolve,
);

/**
 * PATCH /api/v1/incidents/:id/close
 * Close a resolved incident (final terminal state).
 * Restricted to: building_manager, admin
 */
router.patch(
  '/:id/close',
  authMiddleware,
  roleMiddleware(['building_manager', 'admin']),
  incidentController.close,
);

export default router;
