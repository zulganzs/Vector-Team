import type { Request } from 'express';

import { auditLogRepository } from '../repositories/auditLogRepository';
import type { AuditLog } from '../types/domain.types';
import type { PaginationMeta } from '../types/api.types';

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface AuditLogQueryResult {
  data: AuditLog[];
  meta: PaginationMeta;
}

/**
 * Audit log service — records significant system actions and provides
 * a queryable, paginated audit trail.
 *
 * `log()` is fire-and-forget: it NEVER throws and NEVER rejects.
 */
export const auditLogService = {
  /**
   * Create an audit log entry.
   *
   * This method is intentionally fire-and-forget — it wraps the persistence
   * call in a try/catch and silently swallows any errors so that audit
   * logging failures never block or crash the main request flow.
   *
   * @param userId      - ID of the user performing the action (null for system actions)
   * @param action      - Machine-readable action label (e.g. "INCIDENT_DISMISSED")
   * @param entityType  - Entity type being acted upon (e.g. "incident", "user")
   * @param entityId    - ID of the entity (optional)
   * @param oldValues   - Snapshot before the change (optional)
   * @param newValues   - Snapshot after the change (optional)
   * @param req         - Express request for IP / user-agent extraction (optional)
   */
  async log(
    userId: string | null | undefined,
    action: string,
    entityType: string,
    entityId?: string | null,
    oldValues?: Record<string, unknown> | null,
    newValues?: Record<string, unknown> | null,
    req?: Request,
  ): Promise<void> {
    try {
      await auditLogRepository.create({
        user_id: userId ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId ?? null,
        old_values: oldValues != null ? JSON.stringify(oldValues) : null,
        new_values: newValues != null ? JSON.stringify(newValues) : null,
        ip_address: req ? (req.ip ?? null) : null,
        user_agent: req ? (req.headers['user-agent'] ?? null) : null,
      });
    } catch {
      // Intentionally silenced — audit log failures must never affect callers
    }
  },

  /**
   * Query audit logs with filters and pagination.
   *
   * @param filters    - Optional filters (user_id, action, entity_type, date range)
   * @param pagination - Page and limit
   */
  async query(
    filters: AuditLogFilters,
    pagination: { page: number; limit: number },
  ): Promise<AuditLogQueryResult> {
    const { data, total } = await auditLogRepository.findAll(filters, pagination);

    const meta: PaginationMeta = {
      current_page: pagination.page,
      per_page: pagination.limit,
      total,
      total_pages: Math.ceil(total / pagination.limit),
    };

    return { data, meta };
  },
};
