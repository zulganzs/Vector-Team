import { randomUUID } from 'crypto';
import { db } from '../config/database';
import type { SMSLog } from '../types/domain.types';

/**
 * Repository for `sms_logs` table operations.
 */
export const smsLogRepository = {
  /**
   * Persist a new SMS log entry.
   */
  async create(data: Omit<SMSLog, 'id' | 'created_at'>): Promise<SMSLog> {
    const now = new Date().toISOString();
    const newLog: SMSLog = {
      id: randomUUID(),
      created_at: now,
      ...data,
    };
    await db<SMSLog>('sms_logs').insert(newLog);
    return newLog;
  },

  /**
   * Retrieve all SMS log entries for a given notification, ordered by attempt number.
   */
  async findByNotificationId(notificationId: string): Promise<SMSLog[]> {
    return db<SMSLog>('sms_logs')
      .where({ notification_id: notificationId })
      .orderBy('attempt_number', 'asc');
  },
};
