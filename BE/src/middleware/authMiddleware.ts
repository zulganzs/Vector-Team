import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { redisClient } from '../config/redis';
import { env } from '../config/env';

import { AuthenticationError } from '../errors/AuthenticationError';

import type { JwtPayload } from '../types/api.types';

/**
 * Middleware that verifies the JWT access token on every protected route.
 *
 * Flow:
 * 1. Extract `Authorization: Bearer <token>` header.
 * 2. Verify signature and expiry using JWT_SECRET.
 * 3. Check whether the token's `jti` is on the Redis blacklist.
 * 4. Attach decoded payload to `req.user`.
 */
export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided', 'AUTH_TOKEN_MISSING');
    }
    const token = authHeader.slice(7); // strip "Bearer "

    // 2. Verify JWT
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new AuthenticationError('Invalid or expired token', 'AUTH_TOKEN_INVALID');
    }

    // 3. Check blacklist
    const blacklisted = await redisClient.get(`blazewatch:jwt_blacklist:${decoded.jti}`);
    if (blacklisted) {
      throw new AuthenticationError('Token has been revoked', 'AUTH_TOKEN_BLACKLISTED');
    }

    // 4. Attach to request
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      jti: decoded.jti,
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (err) {
    next(err);
  }
};
