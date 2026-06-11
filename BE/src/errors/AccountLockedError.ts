import { AppError } from './AppError';

/**
 * Thrown when a user attempts to log in but their account is locked
 * due to too many failed attempts. Returns HTTP 423 Locked.
 */
export class AccountLockedError extends AppError {
  constructor(message = 'Account is locked', errorCode = 'AUTH_ACCOUNT_LOCKED') {
    super(message, 423, errorCode);
  }
}
