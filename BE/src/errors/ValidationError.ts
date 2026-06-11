import { AppError } from './AppError';

export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(
    message = 'Validation failed',
    errors: Record<string, string[]> = {},
    errorCode = 'VALIDATION_ERROR',
  ) {
    super(message, 422, errorCode);
    this.errors = errors;
  }
}
