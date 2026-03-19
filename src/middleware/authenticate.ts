import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import authConfig from '../config/auth';
import { AppError } from '../utils/AppError';
import db from '../config/database';
import { JwtPayload } from '../types/express';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401, 'AUTH_TOKEN_MISSING');
    }

    const token = authHeader.substring(7);

    let decoded: any;
    try {
      decoded = jwt.verify(token, authConfig.jwtSecret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Access token has expired', 401, 'AUTH_TOKEN_EXPIRED');
      }
      throw new AppError('Invalid access token', 401, 'AUTH_TOKEN_INVALID');
    }

    // Verify user still exists and is active
    const user = await db('users')
      .select('id', 'email', 'role', 'organization_id', 'is_active')
      .where('id', decoded.sub)
      .first();

    if (!user) {
      throw new AppError('User no longer exists', 401, 'AUTH_TOKEN_INVALID');
    }

    if (!user.is_active) {
      throw new AppError('Account has been deactivated', 401, 'AUTH_ACCOUNT_DEACTIVATED');
    }

    // Check org status for partner users
    if (user.organization_id) {
      const org = await db('organizations')
        .select('id', 'status', 'tier_id')
        .where('id', user.organization_id)
        .first();

      if (org && org.status === 'suspended') {
        throw new AppError(
          'Your organization has been suspended. Contact your channel manager.',
          403,
          'ORG_SUSPENDED',
        );
      }

      req.user = {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        org_id: user.organization_id,
        tier_id: org ? org.tier_id : null,
      };
    } else {
      req.user = {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        org_id: null,
        tier_id: null,
      };
    }

    next();
  } catch (err) {
    next(err);
  }
}
