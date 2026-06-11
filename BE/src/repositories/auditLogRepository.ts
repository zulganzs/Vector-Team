import { randomUUID } from 'crypto';
import { db } from '../config/database';
import type { AuditLog } from '../types/domain.types';

/**
 * Repository for `audit_logs` table operations.
 */
export const auditLogRepository = {
  /**
   * Persist a new audit log entry.
   */
  async create(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const now = new Date().toISOString();
    const newLog: AuditLog = {
      id: randomUUID(),
      created_at: now,
      ...data,
    };
    await db<AuditLog>('audit_logs').insert(newLog);
    return newLog;
  },

  /**
   * Return a paginated, filtered list of audit log entries, most recent first.
   */
  async findAll(
    filters: {
      user_id?: string;
      action?: string;
      entity_type?: string;
      date_from?: string;
      date_to?: string;
    },
    pagination: { page: number; limit: number },
  ): Promise<{ data: AuditLog[]; total: number }> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const buildQuery = () => {
      const q = db<AuditLog>('audit_logs');
      if (filters.user_id) q.where({ user_id: filters.user_id });
      if (filters.action) q.where({ action: filters.action });
      if (filters.entity_type) q.where({ entity_type: filters.entity_type });
      if (filters.date_from) q.where('created_at', '>=', filters.date_from);
      if (filters.date_to) q.where('created_at', '<=', filters.date_to);
      return q;
    };

    const [data, countResult] = await Promise.all([
      buildQuery().orderBy('created_at', 'desc').limit(limit).offset(offset),
      buildQuery().count<{ count: number }>('id as count').first(),
    ]);

    const total = Number(countResult?.count ?? 0);
    return { data, total };
  },
};
