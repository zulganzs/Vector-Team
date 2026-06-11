import { z } from 'zod';

/**
 * Validation schema for POST /auth/login.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Validation schema for POST /auth/refresh.
 */
export const refreshTokenSchema = z.object({
  refresh_token: z
    .string()
    .min(1, 'refresh_token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
