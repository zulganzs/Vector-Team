import type { Request, Response, NextFunction } from 'express';

import { AuthorizationError } from '../errors/AuthorizationError';

/**
 * Factory function that returns Express middleware enforcing role-based access.
 *
 * @param allowedRoles - Array of role names that may access the route.
 *
 * @example
 * router.patch('/incidents/:id/dismiss',
 *   authMiddleware,
 *   roleMiddleware(['building_manager', 'admin']),
 *   incidentController.dismiss,
 * );
 */
export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return next(new AuthorizationError('Insufficient permissions', 'FORBIDDEN'));
    }

    next();
  };
};
