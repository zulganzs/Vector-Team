import { z } from 'zod';

/**
 * Validation schema for POST /sensors/data payload.
 *
 * Rules:
 * - sensor_id: alphanumeric + hyphens, max 100 chars
 * - zone_id: max 100 chars
 * - smoke_value: integer 0–4095 (12-bit ADC range)
 * - water_flow: optional, 0–10000 L/min
 * - timestamp: ISO 8601, must not be more than 60 seconds in the future
 */
export const sensorDataSchema = z.object({
  sensor_id: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9-]+$/, 'sensor_id must contain only alphanumeric characters and hyphens'),
  zone_id: z.string().max(100),
  smoke_value: z
    .number()
    .int('smoke_value must be an integer')
    .min(0, 'smoke_value must be at least 0')
    .max(4095, 'smoke_value must be at most 4095'),
  water_flow: z
    .number()
    .min(0, 'water_flow must be at least 0')
    .max(10000, 'water_flow must be at most 10000')
    .optional(),
  timestamp: z
    .string()
    .datetime({ message: 'timestamp must be a valid ISO 8601 datetime string' })
    .refine(
      (val) => new Date(val) <= new Date(Date.now() + 60_000),
      { message: 'Timestamp tidak boleh lebih dari 60 detik ke depan' }
    ),
});

export type SensorDataInput = z.infer<typeof sensorDataSchema>;
