import { createHash, timingSafeEqual } from 'crypto';

import type { Request, Response, NextFunction } from 'express';

import { env } from '../config/env';

import { AuthenticationError } from '../errors/AuthenticationError';
import { AuthorizationError } from '../errors/AuthorizationError';

/**
 * Middleware that authenticates IoT sensor requests via `X-Sensor-API-Key` header.
 *
 * - Compares the SHA-256 hash of the provided key against the hashed environment key.
 * - Uses `crypto.timingSafeEqual` to prevent timing-based side-channel attacks.
 */
export const sensorApiKeyMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const providedKey = req.headers['x-sensor-api-key'];

  // 1. Require the header
  if (!providedKey || typeof providedKey !== 'string') {
    return next(new AuthenticationError('Sensor API key required', 'AUTH_API_KEY_MISSING'));
  }

  // 2. Hash both the provided key and the expected key
  const providedHash = Buffer.from(
    createHash('sha256').update(providedKey).digest('hex'),
  );
  const expectedHash = Buffer.from(
    createHash('sha256').update(env.SENSOR_API_KEY).digest('hex'),
  );

  // 3. Constant-time comparison to prevent timing attacks
  if (providedHash.length !== expectedHash.length || !timingSafeEqual(providedHash, expectedHash)) {
    return next(new AuthorizationError('Invalid sensor API key', 'AUTH_API_KEY_INVALID'));
  }

  next();
};
