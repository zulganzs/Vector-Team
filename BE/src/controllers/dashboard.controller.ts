import type { Request, Response, NextFunction } from 'express';

import { dashboardService } from '../services/dashboardService';

/**
 * Dashboard controller — thin HTTP layer that delegates to `dashboardService`.
 * All responses use the standard `{ success: true, data: ... }` format.
 */

// ─── GET /api/v1/dashboard/summary ───────────────────────────────────────────

/**
 * Return aggregated dashboard summary statistics.
 *
 * Results are cached in Redis for 30 seconds; the `last_updated` field
 * in the response reflects when the cache was last populated.
 *
 * @returns 200 `{ success: true, data: DashboardSummary }`
 */
export const summary = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await dashboardService.getSummary();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/dashboard/sensor-status ─────────────────────────────────────

/**
 * Return all active sensors with their current status, zone name, and last_seen_at.
 *
 * @returns 200 `{ success: true, data: SensorStatusEntry[] }`
 */
export const sensorStatus = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await dashboardService.getSensorStatuses();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/dashboard/active-incidents ───────────────────────────────────

/**
 * Return paginated active incidents enriched with building, zone, and sensor info.
 *
 * Query params: page (default 1), limit (default 20)
 *
 * @returns 200 `{ success: true, data: ActiveIncidentEntry[], meta: PaginationMeta }`
 */
export const activeIncidents = async (
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

    const { data, meta } = await dashboardService.getActiveIncidents({ page, limit });

    res.status(200).json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
};

export const dashboardController = {
  summary,
  sensorStatus,
  activeIncidents,
};
