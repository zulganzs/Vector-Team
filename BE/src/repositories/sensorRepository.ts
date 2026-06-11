import { randomUUID } from 'crypto';
import { db } from '../config/database';
import type { Sensor } from '../types/domain.types';
import { SensorStatus } from '../types/enums';

/**
 * Repository for `sensors` table operations.
 */
export const sensorRepository = {
  /**
   * Find a sensor by its unique sensor_code (e.g. "SENSOR-001").
   */
  async findByCode(sensorCode: string): Promise<Sensor | undefined> {
    const row = await db<Sensor>('sensors').where({ sensor_code: sensorCode }).first();
    return row;
  },

  /**
   * Find a sensor by its UUID primary key.
   */
  async findById(id: string): Promise<Sensor | undefined> {
    const row = await db<Sensor>('sensors').where({ id }).first();
    return row;
  },

  /**
   * Update the status of a sensor and optionally its last_seen_at timestamp.
   */
  async updateStatus(
    id: string,
    status: SensorStatus,
    lastSeenAt?: string,
  ): Promise<void> {
    const updates: Partial<Sensor> & { updated_at: string } = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (lastSeenAt !== undefined) {
      updates.last_seen_at = lastSeenAt;
    }
    await db<Sensor>('sensors').where({ id }).update(updates);
  },

  /**
   * Retrieve all active sensors with their current status.
   */
  async findAllWithStatus(): Promise<Sensor[]> {
    return db<Sensor>('sensors').whereRaw('is_active = 1').select('*');
  },

  /**
   * Find sensors that have not sent data within the given threshold (seconds)
   * and are not already marked offline.
   *
   * Uses a raw datetime subtraction compatible with SQLite's strftime.
   */
  async findOfflineSensors(thresholdSeconds: number): Promise<Sensor[]> {
    // SQLite datetime arithmetic: compare ISO text via strftime epoch
    return db<Sensor>('sensors')
      .whereRaw('is_active = 1')
      .whereNot({ status: SensorStatus.OFFLINE })
      .whereNotNull('last_seen_at')
      .whereRaw(
        `strftime('%s', 'now') - strftime('%s', last_seen_at) >= ?`,
        [thresholdSeconds],
      );
  },
};
