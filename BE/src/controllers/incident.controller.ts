import type { Request, Response, NextFunction } from 'express';

import { incidentService } from '../services/incidentService';
import { incidentRepository } from '../repositories/incidentRepository';
import { NotFoundError } from '../errors/NotFoundError';
import { IncidentStatus } from '../types/enums';
import type { PaginationMeta } from '../types/api.types';
import { db } from '../config/database';

/**
 * Incident controller — thin HTTP layer that delegates to `incidentService`.
 * All actions return a standard `{ success: true, data: ... }` response.
 */

// ─── GET /incidents ────────────────────────────────────────────────────────────

/**
 * List incidents with optional filters and pagination.
 *
 * Query params:
 *   status, building_id, zone_id, date_from, date_to, page (default 1), limit (default 20)
 *
 * @returns 200 `{ success: true, data: Incident[], meta: PaginationMeta }`
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
      status: req.query.status as string | undefined,
      building_id: req.query.building_id as string | undefined,
      zone_id: req.query.zone_id as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
    };

    const { data, total } = await incidentRepository.findAll(filters, {
      page,
      limit,
    });

    const meta: PaginationMeta = {
      current_page: page,
      per_page: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };

    res.status(200).json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
};

// ─── GET /incidents/:id ────────────────────────────────────────────────────────

/**
 * Get a single incident by ID, enriched with building, zone, and sensor names.
 *
 * @returns 200 `{ success: true, data: { incident, building, zone, sensor } }`
 * @throws NotFoundError (404) if incident does not exist
 */
export const show = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const incident = await incidentRepository.findById(id);
    if (!incident) {
      throw new NotFoundError(`Incident '${id}' not found`, 'INCIDENT_NOT_FOUND');
    }

    // Fetch related entities for enriched response
    const [building, zone, sensor] = await Promise.all([
      db('buildings').where({ id: incident.building_id }).select('id', 'name', 'address').first(),
      db('zones').where({ id: incident.zone_id }).select('id', 'name', 'floor').first(),
      db('sensors').where({ id: incident.sensor_id }).select('id', 'name', 'sensor_code', 'type').first(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...incident,
        building: building ?? null,
        zone: zone ?? null,
        sensor: sensor ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /incidents/:id/dismiss ─────────────────────────────────────────────

/**
 * Dismiss an incident (building_manager / admin only).
 *
 * @returns 200 `{ success: true, data: Incident }`
 */
export const dismiss = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const notes = req.body?.notes as string | undefined;
    const actorId = req.user!.id;

    const updated = await incidentService.transitionStatus(
      id,
      IncidentStatus.DISMISSED,
      actorId,
      req.user!.role,
      notes ?? null,
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /incidents/:id/acknowledge ─────────────────────────────────────────

/**
 * Acknowledge an incident (firefighter / admin only).
 *
 * @returns 200 `{ success: true, data: Incident }`
 */
export const acknowledge = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const notes = req.body?.notes as string | undefined;
    const actorId = req.user!.id;

    const updated = await incidentService.transitionStatus(
      id,
      IncidentStatus.ACKNOWLEDGED,
      actorId,
      req.user!.role,
      notes ?? null,
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /incidents/:id/start-evacuation ────────────────────────────────────

/**
 * Start evacuation for an incident (building_manager / admin only).
 *
 * @returns 200 `{ success: true, data: Incident }`
 */
export const startEvacuation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const actorId = req.user!.id;

    const updated = await incidentService.transitionStatus(
      id,
      IncidentStatus.EVACUATION_STARTED,
      actorId,
      req.user!.role,
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /incidents/:id/mark-in-progress ────────────────────────────────────

/**
 * Mark an incident as in-progress (firefighter / admin only).
 *
 * @returns 200 `{ success: true, data: Incident }`
 */
export const markInProgress = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const actorId = req.user!.id;

    const updated = await incidentService.transitionStatus(
      id,
      IncidentStatus.IN_PROGRESS,
      actorId,
      req.user!.role,
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /incidents/:id/resolve ─────────────────────────────────────────────

/**
 * Resolve an incident (firefighter / admin only).
 *
 * @returns 200 `{ success: true, data: Incident }`
 */
export const resolve = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const notes = req.body?.notes as string | undefined;
    const actorId = req.user!.id;

    const updated = await incidentService.transitionStatus(
      id,
      IncidentStatus.RESOLVED,
      actorId,
      req.user!.role,
      notes ?? null,
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /incidents/:id/close ───────────────────────────────────────────────

/**
 * Close a resolved incident (building_manager / admin only).
 *
 * @returns 200 `{ success: true, data: Incident }`
 */
export const close = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const actorId = req.user!.id;

    const updated = await incidentService.transitionStatus(
      id,
      IncidentStatus.CLOSED,
      actorId,
      req.user!.role,
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const incidentController = {
  list,
  show,
  dismiss,
  acknowledge,
  startEvacuation,
  markInProgress,
  resolve,
  close,
};
