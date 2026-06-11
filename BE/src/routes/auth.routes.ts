import { Router } from 'express';

import { loginLimiter } from '../middleware/rateLimiter';
import { authMiddleware } from '../middleware/authMiddleware';
import { authController } from '../controllers/auth.controller';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Authenticate with email + password.
 * Rate-limited to 5 requests/minute per IP.
 */
router.post('/login', loginLimiter, authController.login);

/**
 * POST /api/v1/auth/logout
 * Invalidate the current session.
 * Requires valid JWT.
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * POST /api/v1/auth/refresh
 * Rotate refresh token and issue a new access token pair.
 */
router.post('/refresh', authController.refresh);

/**
 * GET /api/v1/auth/me
 * Return the authenticated user's profile.
 * Requires valid JWT.
 */
router.get('/me', authMiddleware, authController.me);

export default router;
