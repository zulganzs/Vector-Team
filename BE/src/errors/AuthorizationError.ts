import { AppError } from './AppError';

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', errorCode = 'FORBIDDEN') {
    super(message, 403, errorCode);
  }
}
