import { randomUUID } from 'crypto';
import { db } from '../config/database';
import type { Notification } from '../types/domain.types';
import { NotificationStatus } from '../types/enums';

/**
 * Repository for `notifications` table operations.
 */
export const notificationRepository = {
  /**
   * Create a new notification record.
   */
  async create(
    data: Omit<Notification, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Notification> {
    const now = new Date().toISOString();
    const newNotification: Notification = {
      id: randomUUID(),
      created_at: now,
      updated_at: now,
      ...data,
    };
    await db<Notification>('notifications').insert(newNotification);
    return newNotification;
  },

  /**
   * Find a notification by its UUID primary key.
   */
  async findById(id: string): Promise<Notification | undefined> {
    return db<Notification>('notifications').where({ id }).first();
  },

  /**
   * Update the delivery status of a notification.
   * Optionally records the sent_at timestamp (for successful sends).
   */
  async updateStatus(
    id: string,
    status: NotificationStatus,
    sentAt?: string,
  ): Promise<void> {
    const updates: Partial<Notification> & { updated_at: string } = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (sentAt !== undefined) {
      updates.sent_at = sentAt;
    }
    await db<Notification>('notifications').where({ id }).update(updates);
  },

  /**
   * Atomically increment the retry counter for a notification.
   */
  async incrementRetry(id: string): Promise<void> {
    await db<Notification>('notifications')
      .where({ id })
      .increment('retry_count', 1)
      .update({ updated_at: new Date().toISOString() });
  },
};
