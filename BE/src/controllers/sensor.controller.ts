import type { Request, Response, NextFunction } from 'express';

import { sensorDataSchema } from '../schemas/sensorDataSchema';
import { sensorProcessingService } from '../services/sensorProcessingService';
import { sensorRepository } from '../repositories/sensorRepository';
import { sensorReadingRepository } from '../repositories/sensorReadingRepository';
import { ValidationError } from '../errors/ValidationError';
import { NotFoundError } from '../errors/NotFoundError';
import { db } from '../config/database';
import type { PaginationMeta } from '../types/api.types';

/**
 * Sensor controller — thin HTTP layer that delegates to service/repository layers.
 */

// ─── POST /api/v1/sensors/data ────────────────────────────────────────────────

/**
 * Ingest a sensor data reading submitted via HTTP.
 *
 * - Validates the payload with `sensorDataSchema` (Zod)
 * - Delegates processing to `sensorProcessingService.processReading`
 * - Returns the classification result on success
 *
 * @returns 200 OK `{ success: true, data: { reading, classification, is_duplicate } }`
 * @throws ValidationError (422) for invalid payload
 */
export const ingestData = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Validate request body
    const result = sensorDataSchema.safeParse(req.body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'root';
        errors[field] = [...(errors[field] ?? []), issue.message];
      }
      throw new ValidationError('Validation failed', errors);
    }

    const data = await sensorProcessingService.processReading(result.data);

    res.status(200).json({
      success: true,
      data: {
        reading: data.reading,
        classification: data.classification,
        is_duplicate: data.is_duplicate,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sensors ──────────────────────────────────────────────────────

/**
 * List all active sensors with their current status and zone name.
 *
 * @returns 200 `{ success: true, data: SensorWithZone[] }`
 */
export const list = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const sensors = await db('sensors')
      .leftJoin('zones', 'sensors.zone_id', 'zones.id')
      .whereRaw('sensors.is_active = 1')
      .select(
        'sensors.*',
        db.raw('zones.name as zone_name'),
        db.raw('zones.floor as zone_floor'),
      )
      .orderBy('sensors.name', 'asc');

    res.status(200).json({ success: true, data: sensors });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sensors/:id ──────────────────────────────────────────────────

/**
 * Get detailed information for a single sensor, including building and zone info.
 *
 * @returns 200 `{ success: true, data: SensorDetail }`
 * @throws NotFoundError (404) if sensor does not exist
 */
export const show = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const sensor = await sensorRepository.findById(id);
    if (!sensor) {
      throw new NotFoundError(`Sensor '${id}' not found`, 'SENSOR_NOT_FOUND');
    }

    // Enrich with zone and building info
    const [zone, latestReading] = await Promise.all([
      db('zones')
        .leftJoin('buildings', 'zones.building_id', 'buildings.id')
        .where('zones.id', sensor.zone_id)
        .select(
          'zones.id as zone_id',
          'zones.name as zone_name',
          'zones.floor as zone_floor',
          'buildings.id as building_id',
          'buildings.name as building_name',
          'buildings.address as building_address',
        )
        .first(),
      sensorReadingRepository.findLatestBySensorId(id),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...sensor,
        zone: zone ?? null,
        latest_reading: latestReading ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sensors/:id/readings ─────────────────────────────────────────

/**
 * Get paginated reading history for a sensor, ordered by received_at descending.
 *
 * Query params: page (default 1), limit (default 20)
 *
 * @returns 200 `{ success: true, data: SensorReading[], meta: PaginationMeta }`
 * @throws NotFoundError (404) if sensor does not exist
 */
export const readings = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify sensor exists
    const sensor = await sensorRepository.findById(id);
    if (!sensor) {
      throw new NotFoundError(`Sensor '${id}' not found`, 'SENSOR_NOT_FOUND');
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20),
    );

    const { data, total } = await sensorReadingRepository.findBySensorId(id, {
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

export const sensorController = {
  ingestData,
  list,
  show,
  readings,
};
