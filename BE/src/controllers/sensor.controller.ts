import type { Request, Response, NextFunction } from 'express';

import { sensorDataSchema } from '../schemas/sensorDataSchema';
import { sensorProcessingService } from '../services/sensorProcessingService';
import { ValidationError } from '../errors/ValidationError';

/**
 * Sensor controller — thin HTTP layer that delegates to SensorProcessingService.
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

export const sensorController = { ingestData };
