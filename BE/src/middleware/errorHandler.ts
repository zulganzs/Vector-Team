import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ValidationError } from '../errors/ValidationError';

/**
 * Global error handler middleware.
 * Maps custom AppError subclasses to standard API response format.
 * Must be registered last in Express middleware chain.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // Log error (use console in base setup; will be replaced by Winston in later tasks)
  console.error('[ErrorHandler]', err.message, err.stack);

  if (err instanceof ValidationError) {
    res.status(422).json({
      success: false,
      message: err.message,
      error_code: err.errorCode,
      errors: err.errors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error_code: err.errorCode,
    });
    return;
  }

  // Unknown/unexpected errors — don't leak internals in production
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message,
    error_code: 'INTERNAL_SERVER_ERROR',
  });
};
