import { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { auditLogController } from '../controllers/auditLog.controller';

const router = Router();

/**
 * GET /api/v1/audit-logs
 * Paginated, filterable audit log entries.
 * Restricted to: admin only.
 */
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['admin']),
  auditLogController.list,
);

export default router;
