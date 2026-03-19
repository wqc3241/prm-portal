import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  org_id: string | null;
  tier_id: string | null;
}

export type UserRole = 'admin' | 'channel_manager' | 'partner_admin' | 'partner_rep';

export interface OrgScope {
  type: 'all' | 'assigned' | 'own';
  organizationId?: string;
  assignedOrgIds?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgScope?: OrgScope;
    }
  }
}
