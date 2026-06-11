import rateLimit from 'express-rate-limit';

/**
 * General rate limiter: 60 requests per minute per IP.
 * Applied globally to all routes.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    error_code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Login rate limiter: 5 requests per minute per IP.
 * Applied to POST /auth/login only.
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    error_code: 'LOGIN_RATE_LIMIT_EXCEEDED',
  },
});
