import { randomUUID } from 'crypto';
import { db } from '../config/database';
import type { SensorReading } from '../types/domain.types';

/**
 * Repository for `sensor_readings` table operations.
 */
export const sensorReadingRepository = {
  /**
   * Persist a new sensor reading record.
   */
  async create(
    data: Omit<SensorReading, 'id' | 'created_at'>,
  ): Promise<SensorReading> {
    const now = new Date().toISOString();
    const newReading: SensorReading = {
      id: randomUUID(),
      created_at: now,
      ...data,
    };
    await db<SensorReading>('sensor_readings').insert(newReading);
    return newReading;
  },

  /**
   * Retrieve paginated readings for a specific sensor,
   * ordered by received_at descending.
   */
  async findBySensorId(
    sensorId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: SensorReading[]; total: number }> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      db<SensorReading>('sensor_readings')
        .where({ sensor_id: sensorId })
        .orderBy('received_at', 'desc')
        .limit(limit)
        .offset(offset),
      db<SensorReading>('sensor_readings')
        .where({ sensor_id: sensorId })
        .count<{ count: number }>('id as count')
        .first(),
    ]);

    const total = Number(countResult?.count ?? 0);
    return { data, total };
  },

  /**
   * Retrieve the most recent reading for a sensor.
   */
  async findLatestBySensorId(
    sensorId: string,
  ): Promise<SensorReading | undefined> {
    return db<SensorReading>('sensor_readings')
      .where({ sensor_id: sensorId })
      .orderBy('received_at', 'desc')
      .first();
  },
};
