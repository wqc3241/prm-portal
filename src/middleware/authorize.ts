import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { UserRole } from '../types/express';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_TOKEN_MISSING'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perform this action',
          403,
          'AUTH_INSUFFICIENT_ROLE',
        ),
      );
    }

    next();
  };
}
