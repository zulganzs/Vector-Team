import { randomUUID } from 'crypto';
import { db } from '../config/database';
import type { User } from '../types/domain.types';

/**
 * Repository for `users` table operations.
 * All writes generate UUID v4 via crypto.randomUUID().
 * Timestamps are stored as ISO 8601 TEXT.
 */
export const userRepository = {
  /**
   * Find a user by their email address (case-sensitive).
   * Returns undefined if not found or soft-deleted.
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const row = await db<User>('users')
      .whereNull('deleted_at')
      .where({ email })
      .first();
    return row;
  },

  /**
   * Find a user by their UUID primary key.
   * Returns undefined if not found or soft-deleted.
   */
  async findById(id: string): Promise<User | undefined> {
    const row = await db<User>('users')
      .whereNull('deleted_at')
      .where({ id })
      .first();
    return row;
  },

  /**
   * Create a new user record.
   * Generates a UUID and timestamps automatically.
   */
  async create(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const now = new Date().toISOString();
    const newUser: User = {
      id: randomUUID(),
      created_at: now,
      updated_at: now,
      ...data,
    };
    await db<User>('users').insert(newUser);
    return newUser;
  },

  /**
   * Update the failed login attempts counter for a user.
   */
  async updateLoginAttempts(id: string, attempts: number): Promise<void> {
    await db<User>('users').where({ id }).update({
      failed_login_attempts: attempts,
      updated_at: new Date().toISOString(),
    });
  },

  /**
   * Lock a user account until the specified ISO 8601 timestamp.
   */
  async lockAccount(id: string, lockedUntil: string): Promise<void> {
    await db<User>('users').where({ id }).update({
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    });
  },

  /**
   * Update the last_login_at timestamp to now and reset failed attempts.
   */
  async updateLastLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db<User>('users').where({ id }).update({
      last_login_at: now,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: now,
    });
  },
};
