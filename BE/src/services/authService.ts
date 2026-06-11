import { createHash, randomBytes, randomUUID } from 'crypto';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { db } from '../config/database';
import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { userRepository } from '../repositories/userRepository';

import { AccountLockedError } from '../errors/AccountLockedError';
import { AuthenticationError } from '../errors/AuthenticationError';

import type { Role, User } from '../types/domain.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** SHA-256 hash of a plain string, returned as hex. */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** TTL in seconds for the JWT access token. */
const ACCESS_TOKEN_TTL_SECONDS = env.JWT_TTL * 60;

/** TTL in seconds for the refresh token (7 days by default). */
const REFRESH_TOKEN_TTL_SECONDS = env.JWT_REFRESH_TTL * 60;

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Authenticate a user with email and password.
 *
 * @returns Access token, opaque refresh token, and sanitised user object.
 * @throws AuthenticationError (401) for invalid credentials.
 * @throws AccountLockedError (423) when the account is temporarily locked.
 */
export async function login(
  email: string,
  password: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  user: { id: string; name: string; email: string; role: string };
}> {
  // 1. Find user by email
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AuthenticationError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
  }

  // 2. Check account lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AccountLockedError('Account is locked', 'AUTH_ACCOUNT_LOCKED');
  }

  // 3. Verify password
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    // Increment failed attempts (fire-and-forget, non-blocking)
    await incrementFailedAttempts(user.id);
    throw new AuthenticationError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
  }

  // 4. Fetch role name via JOIN
  const roleRow = await db<Role>('roles')
    .where('id', user.role_id)
    .select('name')
    .first();
  const roleName = roleRow?.name ?? 'firefighter';

  // 5. Issue JWT access token
  const jti = randomUUID();
  const payload = {
    sub: user.id,
    role: roleName,
    jti,
  };
  const access_token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });

  // 6. Issue opaque refresh token (64-char hex)
  const refreshToken = randomBytes(32).toString('hex');
  const refreshTokenHash = sha256(refreshToken);

  // 7. Store in Redis
  //    - user:{id}:refresh_token  → SHA-256 hash  (validate by userId)
  //    - blazewatch:refresh_lookup:{hash} → userId (lookup by token)
  await Promise.all([
    redisClient.set(
      `user:${user.id}:refresh_token`,
      refreshTokenHash,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    ),
    redisClient.set(
      `blazewatch:refresh_lookup:${refreshTokenHash}`,
      user.id,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    ),
  ]);

  // 8. Reset failed attempts & update last login
  await userRepository.updateLastLogin(user.id);

  return {
    access_token,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleName,
    },
  };
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * Invalidate the current session.
 * Blacklists the JWT jti and deletes the stored refresh token.
 *
 * @param userId - UUID of the authenticated user.
 * @param jti    - JWT ID claim from the access token to blacklist.
 */
export async function logout(userId: string, jti: string): Promise<void> {
  await Promise.all([
    // Blacklist the access token for its remaining lifetime
    redisClient.set(
      `blazewatch:jwt_blacklist:${jti}`,
      '1',
      'EX',
      ACCESS_TOKEN_TTL_SECONDS,
    ),
    // Remove the refresh token
    redisClient.del(`user:${userId}:refresh_token`),
  ]);
}

// ─── Refresh ─────────────────────────────────────────────────────────────────

/**
 * Rotate the refresh token and issue a new access token.
 *
 * @param token - The opaque refresh token provided by the client.
 * @returns New access token and refresh token pair.
 * @throws AuthenticationError (401) if the token is invalid or expired.
 */
export async function refresh(
  token: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const tokenHash = sha256(token);

  // 1. Look up userId from the hash lookup key
  const userId = await redisClient.get(`blazewatch:refresh_lookup:${tokenHash}`);
  if (!userId) {
    throw new AuthenticationError('Invalid refresh token', 'AUTH_INVALID_REFRESH_TOKEN');
  }

  // 2. Verify the stored hash matches
  const storedHash = await redisClient.get(`user:${userId}:refresh_token`);
  if (!storedHash || storedHash !== tokenHash) {
    throw new AuthenticationError('Invalid refresh token', 'AUTH_INVALID_REFRESH_TOKEN');
  }

  // 3. Delete old Redis keys (token rotation — one-time use)
  await Promise.all([
    redisClient.del(`user:${userId}:refresh_token`),
    redisClient.del(`blazewatch:refresh_lookup:${tokenHash}`),
  ]);

  // 4. Load the user to get current role
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthenticationError('Invalid refresh token', 'AUTH_INVALID_REFRESH_TOKEN');
  }

  const roleRow = await db<Role>('roles')
    .where('id', user.role_id)
    .select('name')
    .first();
  const roleName = roleRow?.name ?? 'firefighter';

  // 5. Issue new access token
  const jti = randomUUID();
  const access_token = jwt.sign(
    { sub: user.id, role: roleName, jti },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );

  // 6. Issue new refresh token and store
  const newRefreshToken = randomBytes(32).toString('hex');
  const newRefreshTokenHash = sha256(newRefreshToken);

  await Promise.all([
    redisClient.set(
      `user:${userId}:refresh_token`,
      newRefreshTokenHash,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    ),
    redisClient.set(
      `blazewatch:refresh_lookup:${newRefreshTokenHash}`,
      userId,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    ),
  ]);

  return { access_token, refresh_token: newRefreshToken };
}

// ─── Failed Attempts ─────────────────────────────────────────────────────────

/**
 * Increment the failed login attempts counter for a user.
 * Locks the account for 15 minutes after 3 consecutive failures.
 *
 * @param userId - UUID of the user who failed authentication.
 */
export async function incrementFailedAttempts(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) return;

  const newCount = (user.failed_login_attempts ?? 0) + 1;
  await userRepository.updateLoginAttempts(userId, newCount);

  if (newCount >= 3) {
    const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await userRepository.lockAccount(userId, lockUntil);
  }
}

// ─── Named export object (optional convenience) ───────────────────────────────

export const authService = {
  login,
  logout,
  refresh,
  incrementFailedAttempts,
};
