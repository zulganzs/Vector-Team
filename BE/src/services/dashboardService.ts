import { redisClient } from '../config/redis';
import { db } from '../config/database';
import { sensorRepository } from '../repositories/sensorRepository';
import { incidentRepository } from '../repositories/incidentRepository';
import type { Sensor, Incident } from '../types/domain.types';
import type { PaginationMeta } from '../types/api.types';

/** Redis key for dashboard summary cache */
const SUMMARY_CACHE_KEY = 'blazewatch:dashboard:summary';
/** TTL in seconds for the dashboard summary cache */
const SUMMARY_CACHE_TTL = 30;

/** Active incident statuses (not terminal) */
const INACTIVE_STATUSES = ['resolved', 'closed', 'dismissed', 'normal'];

export interface DashboardSummary {
  total_sensors: number;
  online_sensors: number;
  offline_sensors: number;
  unknown_sensors: number;
  active_incident_count: number;
  today_incident_count: number;
  avg_smoke_level_last_100: number | null;
  last_updated: string;
}

export interface SensorStatusEntry extends Sensor {
  zone_name: string | null;
}

export interface ActiveIncidentEntry extends Incident {
  building_name: string | null;
  building_address: string | null;
  zone_name: string | null;
  sensor_name: string | null;
  sensor_code: string | null;
}

/**
 * Dashboard service — aggregates read-optimized data for the dashboard UI,
 * with Redis caching to meet the < 300ms P95 target.
 */
export const dashboardService = {
  /**
   * Get the dashboard summary statistics.
   *
   * - Checks Redis cache first (TTL 30s)
   * - On cache miss: queries DB, stores result in cache, returns data
   */
  async getSummary(): Promise<DashboardSummary> {
    // 1. Try Redis cache
    const cached = await redisClient.get(SUMMARY_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as DashboardSummary;
    }

    // 2. Cache miss — aggregate from DB
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      sensorCounts,
      activeIncidentCount,
      todayIncidentCount,
      avgSmokeResult,
    ] = await Promise.all([
      // Sensor status counts (only active sensors)
      db('sensors')
        .whereRaw('is_active = 1')
        .select(db.raw('COUNT(*) as total'))
        .select(db.raw(`SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online`))
        .select(db.raw(`SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline`))
        .select(db.raw(`SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown`))
        .first(),

      // Active incidents count
      db('incidents')
        .whereNotIn('status', INACTIVE_STATUSES)
        .count<{ count: number }>('id as count')
        .first(),

      // Today's incidents count
      db('incidents')
        .where('detected_at', '>=', todayStart)
        .count<{ count: number }>('id as count')
        .first(),

      // Average smoke level from last 100 readings
      db('sensor_readings')
        .select(db.raw('AVG(smoke_value) as avg_smoke'))
        .whereIn(
          'id',
          db('sensor_readings').select('id').orderBy('received_at', 'desc').limit(100),
        )
        .first(),
    ]);

    const summary: DashboardSummary = {
      total_sensors: Number(sensorCounts?.total ?? 0),
      online_sensors: Number(sensorCounts?.online ?? 0),
      offline_sensors: Number(sensorCounts?.offline ?? 0),
      unknown_sensors: Number(sensorCounts?.unknown ?? 0),
      active_incident_count: Number(activeIncidentCount?.count ?? 0),
      today_incident_count: Number(todayIncidentCount?.count ?? 0),
      avg_smoke_level_last_100:
        avgSmokeResult?.avg_smoke != null
          ? Math.round(Number(avgSmokeResult.avg_smoke) * 100) / 100
          : null,
      last_updated: now.toISOString(),
    };

    // 3. Store in Redis with TTL
    await redisClient.setex(SUMMARY_CACHE_KEY, SUMMARY_CACHE_TTL, JSON.stringify(summary));

    return summary;
  },

  /**
   * Get all active sensors with their current status, zone name, and last_seen_at.
   */
  async getSensorStatuses(): Promise<SensorStatusEntry[]> {
    const rows = await db('sensors')
      .leftJoin('zones', 'sensors.zone_id', 'zones.id')
      .whereRaw('sensors.is_active = 1')
      .select(
        'sensors.*',
        db.raw('zones.name as zone_name'),
      )
      .orderBy('sensors.status', 'asc')
      .orderBy('sensors.name', 'asc');

    return rows as SensorStatusEntry[];
  },

  /**
   * Get paginated active incidents with building, zone, and sensor details.
   */
  async getActiveIncidents(
    pagination: { page: number; limit: number },
  ): Promise<{ data: ActiveIncidentEntry[]; meta: PaginationMeta }> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const buildQuery = () =>
      db('incidents')
        .whereNotIn('incidents.status', INACTIVE_STATUSES)
        .leftJoin('buildings', 'incidents.building_id', 'buildings.id')
        .leftJoin('zones', 'incidents.zone_id', 'zones.id')
        .leftJoin('sensors', 'incidents.sensor_id', 'sensors.id');

    const [data, countResult] = await Promise.all([
      buildQuery()
        .select(
          'incidents.*',
          db.raw('buildings.name as building_name'),
          db.raw('buildings.address as building_address'),
          db.raw('zones.name as zone_name'),
          db.raw('sensors.name as sensor_name'),
          db.raw('sensors.sensor_code as sensor_code'),
        )
        .orderBy('incidents.detected_at', 'desc')
        .limit(limit)
        .offset(offset),
      buildQuery().count<{ count: number }>('incidents.id as count').first(),
    ]);

    const total = Number(countResult?.count ?? 0);
    const meta: PaginationMeta = {
      current_page: page,
      per_page: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };

    return { data: data as ActiveIncidentEntry[], meta };
  },
};
