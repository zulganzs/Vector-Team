import type { Request, Response, NextFunction } from 'express';

import { auditLogService } from '../services/auditLogService';

/**
 * Audit Log controller — thin HTTP layer that delegates to `auditLogService`.
 * Admin-only; protected by `authMiddleware` + `roleMiddleware(['admin'])`.
 */

// ─── GET /api/v1/audit-logs ───────────────────────────────────────────────────

/**
 * Return a paginated, filterable list of audit log entries.
 *
 * Query params:
 *   user_id, action, entity_type, date_from, date_to, page (default 1), limit (default 20)
 *
 * @returns 200 `{ success: true, data: AuditLog[], meta: PaginationMeta }`
 */
export const list = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20),
    );

    const filters = {
      user_id: req.query.user_id as string | undefined,
      action: req.query.action as string | undefined,
      entity_type: req.query.entity_type as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
    };

    const { data, meta } = await auditLogService.query(filters, { page, limit });

    res.status(200).json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
};

export const auditLogController = {
  list,
};
