import organizationRepository from '../repositories/organization.repository';
import dealRepository from '../repositories/deal.repository';
import { AppError } from '../utils/AppError';
import { OrgScope, JwtPayload } from '../types/express';
import { VALID_ORG_TRANSITIONS, PARTNER_ROLES } from '../config/constants';
import db from '../config/database';

class OrganizationService {
  async list(
    scope: OrgScope,
    filters: {
      status?: string;
      tier_id?: string;
      channel_manager_id?: string;
      search?: string;
    },
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return organizationRepository.list(scope, filters, pagination, sort);
  }

  async getById(id: string, scope: OrgScope) {
    const org = await organizationRepository.findById(id, scope);
    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    // Shape tier data
    const { tier_name, tier_rank, tier_color_hex, ...rest } = org;
    if (tier_name) {
      rest.tier = { id: rest.tier_id, name: tier_name, rank: tier_rank, color_hex: tier_color_hex };
    }
    return rest;
  }

  async create(data: any, requestor: JwtPayload) {
    // Validate channel_manager_id if provided
    if (data.channel_manager_id) {
      await this.validateChannelManager(data.channel_manager_id);
    }

    // Set defaults
    if (!data.tier_id) {
      const defaultTier = await db('partner_tiers').where('rank', 1).select('id').first();
      data.tier_id = defaultTier?.id;
    }

    if (!data.status) {
      data.status = 'prospect';
    }

    return organizationRepository.create(data);
  }

  async update(id: string, data: any, requestor: JwtPayload, scope: OrgScope) {
    const org = await organizationRepository.findById(id, scope);
    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    const updates: Record<string, any> = {};

    if (requestor.role === 'admin') {
      // Admin can update everything
      const allowed = [
        'name', 'legal_name', 'domain', 'tier_id', 'status', 'industry',
        'employee_count', 'website', 'phone', 'address_line1', 'address_line2',
        'city', 'state_province', 'postal_code', 'country', 'channel_manager_id',
        'logo_url', 'notes',
      ];
      for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
      }
    } else if (requestor.role === 'channel_manager') {
      // CM can update org including status
      const allowed = [
        'name', 'legal_name', 'domain', 'status', 'industry',
        'employee_count', 'website', 'phone', 'address_line1', 'address_line2',
        'city', 'state_province', 'postal_code', 'country', 'logo_url', 'notes',
      ];
      for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
      }
    } else if (requestor.role === 'partner_admin') {
      // partner_admin: non-sensitive fields only
      const allowed = [
        'name', 'phone', 'website', 'address_line1', 'address_line2',
        'city', 'state_province', 'postal_code', 'country', 'industry',
        'employee_count', 'logo_url', 'notes',
      ];
      for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
      }
      // Silently ignore status, tier_id, channel_manager_id
    } else {
      throw AppError.forbidden('You do not have permission to update organizations', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Validate status transition if changing status
    if (updates.status && updates.status !== org.status) {
      const validTransitions = VALID_ORG_TRANSITIONS[org.status] || [];
      if (!validTransitions.includes(updates.status)) {
        throw new AppError(
          `Invalid status transition from '${org.status}' to '${updates.status}'`,
          422,
          'ORG_INVALID_STATUS_TRANSITION',
        );
      }
    }

    // Validate channel_manager_id if changing
    if (updates.channel_manager_id) {
      await this.validateChannelManager(updates.channel_manager_id);
    }

    if (Object.keys(updates).length === 0) {
      return this.getById(id, scope);
    }

    const updated = await organizationRepository.update(id, updates);
    return updated;
  }

  async getOrgUsers(orgId: string, scope: OrgScope, pagination: { offset: number; limit: number }) {
    // Verify org exists within scope
    const org = await organizationRepository.findById(orgId, scope);
    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    return organizationRepository.getOrgUsers(orgId, pagination);
  }

  async getOrgDeals(orgId: string, scope: OrgScope, pagination?: { offset: number; limit: number }) {
    const org = await organizationRepository.findById(orgId, scope);
    if (!org) throw AppError.notFound('Organization not found');

    const pag = pagination || { offset: 0, limit: 25 };
    // Scope to the specific org regardless of the user's broader scope
    const orgScope: OrgScope = { type: 'own', organizationId: orgId };
    return dealRepository.list(orgScope, {}, pag);
  }

  async getOrgLeads(orgId: string, scope: OrgScope) {
    const org = await organizationRepository.findById(orgId, scope);
    if (!org) throw AppError.notFound('Organization not found');
    return [];
  }

  async getOrgQuotes(orgId: string, scope: OrgScope) {
    const org = await organizationRepository.findById(orgId, scope);
    if (!org) throw AppError.notFound('Organization not found');
    return [];
  }

  async getOrgMdf(orgId: string, scope: OrgScope) {
    const org = await organizationRepository.findById(orgId, scope);
    if (!org) throw AppError.notFound('Organization not found');
    return [];
  }

  async getDashboard(orgId: string, scope: OrgScope) {
    const org = await organizationRepository.findById(orgId, scope);
    if (!org) throw AppError.notFound('Organization not found');
    // Phase 1: return skeleton
    return {
      message: 'Dashboard not implemented in Phase 1',
      organization_id: orgId,
    };
  }

  async recalculateTier(orgId: string, scope: OrgScope) {
    const org = await organizationRepository.findById(orgId, scope);
    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    const oldTierId = org.tier_id;
    const newTierId = await organizationRepository.calculateTier(orgId);

    let oldTier = null;
    let newTier = null;

    if (oldTierId) {
      oldTier = await db('partner_tiers').where('id', oldTierId).first();
    }
    if (newTierId) {
      newTier = await db('partner_tiers').where('id', newTierId).first();
    }

    if (newTierId && newTierId !== oldTierId) {
      await organizationRepository.update(orgId, { tier_id: newTierId });
    }

    return {
      organization_id: orgId,
      old_tier: oldTier ? { id: oldTier.id, name: oldTier.name, rank: oldTier.rank } : null,
      new_tier: newTier ? { id: newTier.id, name: newTier.name, rank: newTier.rank } : null,
      changed: newTierId !== oldTierId,
    };
  }

  private async validateChannelManager(userId: string) {
    const user = await db('users').where('id', userId).select('role').first();
    if (!user) {
      throw new AppError('Channel manager user not found', 422, 'ORG_INVALID_CHANNEL_MANAGER');
    }
    if (user.role !== 'channel_manager') {
      throw new AppError(
        'The referenced user must have role channel_manager',
        422,
        'ORG_INVALID_CHANNEL_MANAGER',
      );
    }
  }
}

export default new OrganizationService();
