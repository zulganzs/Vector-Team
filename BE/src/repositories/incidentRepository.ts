import { randomUUID } from 'crypto';
import { db } from '../config/database';
import type { Incident } from '../types/domain.types';

/** Statuses that mean the incident is no longer active. */
const INACTIVE_STATUSES = ['resolved', 'closed', 'dismissed', 'normal'] as const;

/**
 * Repository for `incidents` table operations.
 */
export const incidentRepository = {
  /**
   * Create a new incident record.
   */
  async create(
    data: Omit<Incident, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Incident> {
    const now = new Date().toISOString();
    const newIncident: Incident = {
      id: randomUUID(),
      created_at: now,
      updated_at: now,
      ...data,
    };
    await db<Incident>('incidents').insert(newIncident);
    return newIncident;
  },

  /**
   * Find an incident by its UUID primary key.
   */
  async findById(id: string): Promise<Incident | undefined> {
    return db<Incident>('incidents').where({ id }).first();
  },

  /**
   * Find the currently active incident for a sensor.
   * Active = status NOT IN (resolved, closed, dismissed, normal).
   * There should only ever be one per sensor at a time.
   */
  async findActiveForSensor(sensorId: string): Promise<Incident | undefined> {
    return db<Incident>('incidents')
      .where({ sensor_id: sensorId })
      .whereNotIn('status', [...INACTIVE_STATUSES])
      .orderBy('detected_at', 'desc')
      .first();
  },

  /**
   * Return a paginated, filtered list of incidents.
   */
  async findAll(
    filters: {
      status?: string;
      building_id?: string;
      zone_id?: string;
      date_from?: string;
      date_to?: string;
    },
    pagination: { page: number; limit: number },
  ): Promise<{ data: Incident[]; total: number }> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const buildQuery = () => {
      const q = db<Incident>('incidents');
      if (filters.status) q.where('status', filters.status);
      if (filters.building_id) q.where('building_id', filters.building_id);
      if (filters.zone_id) q.where('zone_id', filters.zone_id);
      if (filters.date_from) q.where('detected_at', '>=', filters.date_from);
      if (filters.date_to) q.where('detected_at', '<=', filters.date_to);
      return q;
    };

    const [data, countResult] = await Promise.all([
      buildQuery().orderBy('detected_at', 'desc').limit(limit).offset(offset),
      buildQuery().count<{ count: number }>('id as count').first(),
    ]);

    const total = Number(countResult?.count ?? 0);
    return { data, total };
  },

  /**
   * Apply partial updates to an incident (status transitions, timestamps, notes, etc.)
   * and return the updated record.
   */
  async updateStatus(
    id: string,
    updates: Partial<Incident>,
  ): Promise<Incident> {
    const now = new Date().toISOString();
    await db<Incident>('incidents')
      .where({ id })
      .update({ ...updates, updated_at: now });

    const updated = await db<Incident>('incidents').where({ id }).first();
    if (!updated) {
      throw new Error(`Incident ${id} not found after update`);
    }
    return updated;
  },

  /**
   * Find incidents in RESOLVED status whose resolved_at is older than `hours` hours ago.
   * Used by the auto-close cron job.
   */
  async findResolvedOlderThan(hours: number): Promise<Incident[]> {
    // SQLite: use strftime epoch difference
    return db<Incident>('incidents')
      .where({ status: 'resolved' })
      .whereNotNull('resolved_at')
      .whereRaw(
        `strftime('%s', 'now') - strftime('%s', resolved_at) >= ?`,
        [hours * 3600],
      );
  },
};
