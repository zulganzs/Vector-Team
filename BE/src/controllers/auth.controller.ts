import type { Request, Response, NextFunction } from 'express';

import { db } from '../config/database';
import { authService } from '../services/authService';
import { userRepository } from '../repositories/userRepository';

import { loginSchema, refreshTokenSchema } from '../schemas/authSchema';
import { ValidationError } from '../errors/ValidationError';

import type { Role } from '../types/domain.types';

/**
 * Thin controller for authentication endpoints.
 * All business logic is delegated to authService.
 */

// ─── POST /api/v1/auth/login ─────────────────────────────────────────────────

/**
 * Authenticate with email + password, receive JWT access token and refresh token.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.');
        errors[field] = [...(errors[field] ?? []), issue.message];
      }
      throw new ValidationError('Validation failed', errors);
    }

    const { email, password } = result.data;
    const data = await authService.login(email, password);

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────

/**
 * Invalidate the current session — blacklist the JWT and delete the refresh token.
 * Requires a valid JWT (authMiddleware must run before this).
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await authService.logout(req.user!.id, req.user!.jti);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────

/**
 * Rotate the refresh token and return a new access + refresh token pair.
 */
export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = refreshTokenSchema.safeParse(req.body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.');
        errors[field] = [...(errors[field] ?? []), issue.message];
      }
      throw new ValidationError('Validation failed', errors);
    }

    const { refresh_token } = result.data;
    const data = await authService.refresh(refresh_token);

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────

/**
 * Return the authenticated user's profile.
 * Requires a valid JWT (authMiddleware must run before this).
 */
export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await userRepository.findById(req.user!.id);
    if (!user) {
      // Edge case: user deleted after token was issued
      res.status(404).json({
        success: false,
        message: 'User not found',
        error_code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Fetch current role name
    const roleRow = await db<Role>('roles')
      .where('id', user.role_id)
      .select('name')
      .first();
    const roleName = roleRow?.name ?? req.user!.role;

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleName,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const authController = { login, logout, refresh, me };
