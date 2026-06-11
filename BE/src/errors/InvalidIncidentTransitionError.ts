import { AppError } from './AppError';

export class InvalidIncidentTransitionError extends AppError {
  constructor(
    fromStatus: string,
    toStatus: string,
    errorCode = 'INVALID_INCIDENT_TRANSITION',
  ) {
    super(
      `Invalid incident status transition from '${fromStatus}' to '${toStatus}'`,
      409,
      errorCode,
    );
  }
}
