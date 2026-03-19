import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import db from '../config/database';
import { OrgScope } from '../types/express';

export async function scopeToOrg(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_TOKEN_MISSING');
    }

    const { role, sub, org_id } = req.user;

    if (role === 'admin') {
      req.orgScope = { type: 'all' };
    } else if (role === 'channel_manager') {
      // Find all orgs assigned to this channel manager
      const assignedOrgs = await db('organizations')
        .select('id')
        .where('channel_manager_id', sub);
      const assignedOrgIds = assignedOrgs.map((o) => o.id);
      req.orgScope = { type: 'assigned', assignedOrgIds };
    } else {
      // partner_admin or partner_rep
      if (!org_id) {
        throw new AppError('User is not associated with an organization', 403, 'AUTH_ORG_MISMATCH');
      }
      req.orgScope = { type: 'own', organizationId: org_id };
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Apply org scope filtering to a Knex query builder.
 * Returns the modified query. If the org column is not 'organization_id',
 * pass the column name as the second parameter.
 */
export function applyOrgScope(
  query: any,
  scope: OrgScope,
  orgColumn: string = 'organization_id',
): any {
  if (scope.type === 'all') {
    return query;
  }
  if (scope.type === 'assigned') {
    return query.whereIn(orgColumn, scope.assignedOrgIds || []);
  }
  // 'own'
  return query.where(orgColumn, scope.organizationId);
}
