import { AppError } from './AppError';

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', errorCode = 'AUTH_TOKEN_MISSING') {
    super(message, 401, errorCode);
  }
}
