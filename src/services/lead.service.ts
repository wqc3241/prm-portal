import leadRepository, { LeadFilters } from '../repositories/lead.repository';
import dealService from './deal.service';
import notificationService from './notification.service';
import { AppError } from '../utils/AppError';
import { OrgScope, JwtPayload } from '../types/express';
import {
  VALID_LEAD_TRANSITIONS,
  LEAD_SLA_HOURS,
  LEAD_MULTIPLE_RETURN_THRESHOLD,
  LEAD_ASSIGNMENT_WEIGHTS,
  LEAD_MAX_ACTIVE_BY_TIER_RANK,
  GEO_REGIONS,
  RELATED_INDUSTRIES,
} from '../config/constants';
import db from '../config/database';

class LeadService {
  // ─── Create Lead ─────────────────────────────────────────────────────
  async createLead(data: Record<string, any>, user: JwtPayload) {
    const leadData: Record<string, any> = {
      ...data,
      status: 'new',
    };

    const lead = await leadRepository.create(leadData);
    return lead;
  }

  // ─── Get Lead ────────────────────────────────────────────────────────
  async getLead(leadId: string, scope: OrgScope) {
    const lead = await leadRepository.findById(leadId, scope);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }
    return lead;
  }

  // ─── List Leads ──────────────────────────────────────────────────────
  async listLeads(
    scope: OrgScope,
    filters: LeadFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return leadRepository.list(scope, filters, pagination, sort);
  }

  // ─── Update Lead ─────────────────────────────────────────────────────
  async updateLead(
    leadId: string,
    data: Record<string, any>,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const lead = await leadRepository.findById(leadId, scope);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }

    // Only new, assigned, or accepted leads can be updated
    const editableStatuses = ['new', 'assigned', 'accepted', 'contacted', 'qualified'];
    if (!editableStatuses.includes(lead.status)) {
      throw new AppError(
        `Cannot edit lead in '${lead.status}' status`,
        422,
        'LEAD_INVALID_TRANSITION',
      );
    }

    // Handle status progression (contacted, qualified) via update
    if (data.status) {
      this.validateTransition(lead.status, data.status);

      const updated = await leadRepository.updateStatus(lead.id, lead.status, data.status);
      if (!updated) {
        throw new AppError(
          `Cannot transition from '${lead.status}' to '${data.status}'. Lead may have been modified concurrently.`,
          422,
          'LEAD_INVALID_TRANSITION',
        );
      }

      // Log activity for status change
      await leadRepository.insertActivity({
        actor_id: user.sub,
        action: data.status,
        entity_type: 'lead',
        entity_id: lead.id,
        summary: `Lead ${lead.lead_number} status changed to ${data.status}`,
        changes: { status: { old: lead.status, new: data.status } },
        organization_id: lead.assigned_org_id,
      });

      // Remove status from data to avoid double-setting
      delete data.status;
    }

    // Update remaining fields
    const allowed = [
      'first_name', 'last_name', 'email', 'phone', 'company_name', 'title',
      'industry', 'company_size', 'city', 'state_province', 'country',
      'source', 'campaign_name', 'score', 'budget', 'timeline',
      'interest_notes', 'tags',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    if (Object.keys(updates).length > 0) {
      await leadRepository.updateFields(leadId, updates);
    }

    // Re-fetch with joins
    return leadRepository.findById(leadId, scope);
  }

  // ─── Assign Lead ─────────────────────────────────────────────────────
  async assignLead(
    leadId: string,
    organizationId: string,
    user: JwtPayload,
    scope: OrgScope,
    userId?: string | null,
  ) {
    // Fetch lead -- admins/CMs need to see unassigned leads, use a broad scope for finding
    const lead = await leadRepository.findById(leadId, { type: 'all' });
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }

    // Validate transition
    this.validateTransition(lead.status, 'assigned');

    // Validate target org exists and is active
    const org = await db('organizations as o')
      .leftJoin('partner_tiers as t', 'o.tier_id', 't.id')
      .select('o.id', 'o.name', 'o.status', 'o.channel_manager_id', 't.rank as tier_rank')
      .where('o.id', organizationId)
      .first();

    if (!org) {
      throw new AppError('Organization not found', 422, 'ORG_NOT_FOUND');
    }

    if (org.status !== 'active') {
      throw new AppError('Organization is not active', 422, 'ORG_NOT_ACTIVE');
    }

    // CM can only assign to their managed orgs
    if (user.role === 'channel_manager' && org.channel_manager_id !== user.sub) {
      throw AppError.forbidden(
        'You can only assign leads to organizations you manage',
        'AUTH_ORG_MISMATCH',
      );
    }

    // Validate org has at least one active user
    const activeUserCount = await db('users')
      .where('organization_id', organizationId)
      .where('is_active', true)
      .count('* as total')
      .first();

    if (!activeUserCount || parseInt(activeUserCount.total as string, 10) === 0) {
      throw new AppError(
        'Cannot assign lead to organization with no active users',
        422,
        'ORG_NO_ACTIVE_USERS',
      );
    }

    // If user_id provided, validate user belongs to org
    if (userId) {
      const assignedUser = await db('users')
        .where('id', userId)
        .where('organization_id', organizationId)
        .where('is_active', true)
        .first();

      if (!assignedUser) {
        throw new AppError(
          'Assigned user not found in the target organization',
          422,
          'USER_NOT_IN_ORG',
        );
      }
    }

    // Set SLA deadline
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + LEAD_SLA_HOURS);

    const updated = await leadRepository.updateStatus(lead.id, lead.status, 'assigned', {
      assigned_org_id: organizationId,
      assigned_user_id: userId || null,
      assigned_at: new Date(),
      sla_deadline: slaDeadline,
      accepted_at: null,
      return_reason: null,
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${lead.status}' to 'assigned'. Lead may have been modified concurrently.`,
        422,
        'LEAD_INVALID_TRANSITION',
      );
    }

    // Log activity
    await leadRepository.insertActivity({
      actor_id: user.sub,
      action: 'assigned',
      entity_type: 'lead',
      entity_id: lead.id,
      summary: `Lead ${lead.lead_number} assigned to ${org.name}`,
      changes: {
        status: { old: lead.status, new: 'assigned' },
        assigned_org_id: { old: lead.assigned_org_id, new: organizationId },
      },
      organization_id: organizationId,
    });

    // Notify partner admin of the assigned org
    const partnerAdmin = await db('users')
      .where('organization_id', organizationId)
      .where('role', 'partner_admin')
      .where('is_active', true)
      .first();

    if (partnerAdmin) {
      await notificationService.createNotification({
        user_id: partnerAdmin.id,
        type: 'lead_assigned',
        title: `New lead assigned: ${lead.lead_number} - ${lead.company_name || 'Unknown Company'}`,
        body: `${lead.first_name} ${lead.last_name}${lead.company_name ? ` at ${lead.company_name}` : ''}. Accept within 48 hours.`,
        entity_type: 'lead',
        entity_id: lead.id,
        action_url: `/leads/${lead.id}`,
      });
    }

    return {
      id: lead.id,
      lead_number: lead.lead_number,
      status: 'assigned',
      assigned_org_id: organizationId,
      assigned_org_name: org.name,
      assigned_user_id: userId || null,
      assigned_at: updated.assigned_at,
      sla_deadline: updated.sla_deadline,
      updated_at: updated.updated_at,
    };
  }

  // ─── Bulk Assign ─────────────────────────────────────────────────────
  async bulkAssign(
    assignments: Array<{ lead_id: string; organization_id: string; user_id?: string | null }>,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const results: Array<{
      lead_id: string;
      success: boolean;
      lead_number?: string;
      error?: { code: string; message: string };
    }> = [];

    let succeeded = 0;
    let failed = 0;

    for (const assignment of assignments) {
      try {
        const result = await this.assignLead(
          assignment.lead_id,
          assignment.organization_id,
          user,
          scope,
          assignment.user_id,
        );
        results.push({
          lead_id: assignment.lead_id,
          success: true,
          lead_number: result.lead_number,
        });
        succeeded++;
      } catch (err: any) {
        results.push({
          lead_id: assignment.lead_id,
          success: false,
          error: {
            code: err.code || 'UNKNOWN_ERROR',
            message: err.message,
          },
        });
        failed++;
      }
    }

    return {
      total: assignments.length,
      succeeded,
      failed,
      results,
    };
  }

  // ─── Get Unassigned Leads ────────────────────────────────────────────
  async getUnassigned(
    scope: OrgScope,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return leadRepository.findUnassigned(scope, pagination, sort);
  }

  // ─── Accept Lead ─────────────────────────────────────────────────────
  async acceptLead(leadId: string, user: JwtPayload, scope: OrgScope) {
    const lead = await leadRepository.findById(leadId, scope);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }

    // Validate status transition first so the caller gets a clear
    // LEAD_INVALID_TRANSITION (422) when the lead is not in 'assigned' status,
    // rather than the misleading LEAD_NOT_ASSIGNED (403) from the org check.
    this.validateTransition(lead.status, 'accepted');

    // Validate lead is assigned to user's org
    if (
      (user.role === 'partner_admin' || user.role === 'partner_rep') &&
      lead.assigned_org_id !== user.org_id
    ) {
      throw AppError.forbidden(
        'Lead is not assigned to your organization',
        'LEAD_NOT_ASSIGNED',
      );
    }

    const updated = await leadRepository.updateStatus(lead.id, lead.status, 'accepted', {
      accepted_at: new Date(),
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${lead.status}' to 'accepted'. Lead may have been modified concurrently.`,
        422,
        'LEAD_INVALID_TRANSITION',
      );
    }

    // Log activity
    await leadRepository.insertActivity({
      actor_id: user.sub,
      action: 'accepted',
      entity_type: 'lead',
      entity_id: lead.id,
      summary: `Lead ${lead.lead_number} accepted`,
      changes: { status: { old: lead.status, new: 'accepted' } },
      organization_id: lead.assigned_org_id,
    });

    return {
      id: lead.id,
      lead_number: lead.lead_number,
      status: 'accepted',
      accepted_at: updated.accepted_at,
      updated_at: updated.updated_at,
    };
  }

  // ─── Return Lead ─────────────────────────────────────────────────────
  async returnLead(
    leadId: string,
    returnReason: string,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const lead = await leadRepository.findById(leadId, scope);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }

    // Validate lead is assigned to user's org (for partner roles)
    if (
      (user.role === 'partner_admin' || user.role === 'partner_rep') &&
      lead.assigned_org_id !== user.org_id
    ) {
      throw AppError.forbidden(
        'Lead is not assigned to your organization',
        'LEAD_NOT_ASSIGNED',
      );
    }

    this.validateTransition(lead.status, 'returned');

    const oldOrgId = lead.assigned_org_id;
    const oldOrgName = lead.assigned_org_name;

    const updated = await leadRepository.updateStatus(lead.id, lead.status, 'returned', {
      return_reason: returnReason,
      assigned_org_id: null,
      assigned_user_id: null,
      accepted_at: null,
      sla_deadline: null,
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${lead.status}' to 'returned'. Lead may have been modified concurrently.`,
        422,
        'LEAD_INVALID_TRANSITION',
      );
    }

    // Log activity
    await leadRepository.insertActivity({
      actor_id: user.sub,
      action: 'returned',
      entity_type: 'lead',
      entity_id: lead.id,
      summary: `Lead ${lead.lead_number} returned: ${returnReason.substring(0, 100)}`,
      changes: {
        status: { old: lead.status, new: 'returned' },
        return_reason: returnReason,
      },
      organization_id: oldOrgId,
    });

    // Check for multiple returns
    const returnCount = await leadRepository.getReturnCount(lead.id);
    if (returnCount >= LEAD_MULTIPLE_RETURN_THRESHOLD) {
      // Add 'multiple_returns' tag
      const currentTags: string[] = lead.tags || [];
      if (!currentTags.includes('multiple_returns')) {
        await leadRepository.updateFields(lead.id, {
          tags: db.raw("array_append(COALESCE(tags, '{}'), ?)", ['multiple_returns']),
        });
      }

      await leadRepository.insertActivity({
        actor_id: user.sub,
        action: 'multiple_return_warning',
        entity_type: 'lead',
        entity_id: lead.id,
        summary: `Lead ${lead.lead_number} has been returned ${returnCount} times`,
        changes: { return_count: returnCount },
        organization_id: oldOrgId,
      });
    }

    // Notify the assigning CM
    if (oldOrgId) {
      const org = await db('organizations')
        .select('channel_manager_id')
        .where('id', oldOrgId)
        .first();

      if (org?.channel_manager_id) {
        const reasonPreview = returnReason.length > 80
          ? returnReason.substring(0, 80) + '...'
          : returnReason;

        await notificationService.createNotification({
          user_id: org.channel_manager_id,
          type: 'lead_assigned',
          title: `Lead ${lead.lead_number} returned by ${oldOrgName || 'partner'}: ${reasonPreview}`,
          body: `Return reason: ${returnReason}`,
          entity_type: 'lead',
          entity_id: lead.id,
          action_url: `/leads/${lead.id}`,
        });
      }
    }

    return {
      id: lead.id,
      lead_number: lead.lead_number,
      status: 'returned',
      return_reason: returnReason,
      updated_at: updated.updated_at,
    };
  }

  // ─── Convert Lead to Deal ────────────────────────────────────────────
  async convertLead(
    leadId: string,
    user: JwtPayload,
    scope: OrgScope,
    overrides?: { deal_name?: string; estimated_value?: number; expected_close_date?: string },
  ) {
    const lead = await leadRepository.findById(leadId, scope);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }

    // Validate lead is assigned to user's org (for partner roles)
    if (
      (user.role === 'partner_admin' || user.role === 'partner_rep') &&
      lead.assigned_org_id !== user.org_id
    ) {
      throw AppError.forbidden(
        'Lead is not assigned to your organization',
        'LEAD_NOT_ASSIGNED',
      );
    }

    // Check if already converted
    if (lead.status === 'converted') {
      const err: any = new AppError(
        'Lead has already been converted to a deal',
        422,
        'LEAD_ALREADY_CONVERTED',
      );
      err.converted_deal_id = lead.converted_deal_id;
      throw err;
    }

    // Validate transition
    this.validateTransition(lead.status, 'converted');

    // Build deal data from lead fields
    const customerAddress = [lead.city, lead.state_province, lead.country]
      .filter(Boolean)
      .join(', ');

    const dealData: Record<string, any> = {
      customer_company_name: lead.company_name || 'Unknown Company',
      customer_contact_name: `${lead.first_name} ${lead.last_name}`.trim(),
      customer_contact_email: lead.email || null,
      customer_contact_phone: lead.phone || null,
      customer_industry: lead.industry || null,
      customer_address: customerAddress || null,
      deal_name: overrides?.deal_name || `${lead.company_name || 'Lead'} - Converted from ${lead.lead_number}`,
      description: lead.interest_notes || null,
      estimated_value: overrides?.estimated_value || lead.budget || 0,
      expected_close_date: overrides?.expected_close_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      source: 'lead_conversion',
      tags: ['converted_from_lead'],
    };

    // Create deal using deal service.
    // NOTE: Ideally deal creation and lead status update would be wrapped in a
    // single DB transaction (PRD Risk mitigation). This requires dealService.createDeal
    // to accept a knex transaction object — tracked as a future refactoring task.
    // Current mitigation: optimistic concurrency guard on lead status update ensures
    // that if a concurrent modification happens, the error surfaces clearly. The
    // orphaned draft deal (if any) is recoverable by admins via GET /deals.
    const deal = await dealService.createDeal(dealData, user);

    // Update lead with conversion info
    const updated = await leadRepository.updateStatus(lead.id, lead.status, 'converted', {
      converted_deal_id: deal.id,
      converted_at: new Date(),
    });

    if (!updated) {
      // Concurrent modification: the lead status changed between our read and this
      // write. The deal was already created (orphaned draft). Log for admin review.
      console.error(
        `[convertLead] Concurrent modification on lead ${lead.id}. ` +
        `Deal ${deal.id} was created but lead status update failed. ` +
        `The deal is in 'draft' status and can be reviewed by an admin.`,
      );
      throw new AppError(
        `Cannot transition from '${lead.status}' to 'converted'. Lead may have been modified concurrently.`,
        422,
        'LEAD_INVALID_TRANSITION',
      );
    }

    // Log activity
    await leadRepository.insertActivity({
      actor_id: user.sub,
      action: 'converted',
      entity_type: 'lead',
      entity_id: lead.id,
      summary: `Lead ${lead.lead_number} converted to deal ${deal.deal_number}`,
      changes: {
        status: { old: lead.status, new: 'converted' },
        converted_deal_id: deal.id,
        converted_deal_number: deal.deal_number,
      },
      organization_id: lead.assigned_org_id,
    });

    // Notify the CM
    if (lead.assigned_org_id) {
      const org = await db('organizations')
        .select('channel_manager_id', 'name')
        .where('id', lead.assigned_org_id)
        .first();

      if (org?.channel_manager_id) {
        await notificationService.createNotification({
          user_id: org.channel_manager_id,
          type: 'deal_update',
          title: `Lead ${lead.lead_number} converted to deal ${deal.deal_number} by ${org.name}`,
          body: `${lead.first_name} ${lead.last_name} at ${lead.company_name || 'Unknown'} has been converted to a deal registration.`,
          entity_type: 'deal',
          entity_id: deal.id,
          action_url: `/deals/${deal.id}`,
        });
      }
    }

    return {
      id: lead.id,
      lead_number: lead.lead_number,
      status: 'converted',
      converted_deal_id: deal.id,
      converted_deal_number: deal.deal_number,
      converted_at: updated.converted_at,
      updated_at: updated.updated_at,
    };
  }

  // ─── Disqualify Lead ─────────────────────────────────────────────────
  async disqualifyLead(
    leadId: string,
    disqualifyReason: string,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const lead = await leadRepository.findById(leadId, scope);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }

    this.validateTransition(lead.status, 'disqualified');

    const updated = await leadRepository.updateStatus(lead.id, lead.status, 'disqualified', {
      disqualify_reason: disqualifyReason,
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${lead.status}' to 'disqualified'. Lead may have been modified concurrently.`,
        422,
        'LEAD_INVALID_TRANSITION',
      );
    }

    // Log activity
    await leadRepository.insertActivity({
      actor_id: user.sub,
      action: 'disqualified',
      entity_type: 'lead',
      entity_id: lead.id,
      summary: `Lead ${lead.lead_number} disqualified: ${disqualifyReason.substring(0, 100)}`,
      changes: {
        status: { old: lead.status, new: 'disqualified' },
        disqualify_reason: disqualifyReason,
      },
      organization_id: lead.assigned_org_id,
    });

    return {
      id: lead.id,
      lead_number: lead.lead_number,
      status: 'disqualified',
      disqualify_reason: disqualifyReason,
      updated_at: updated.updated_at,
    };
  }

  // ─── Get Lead History ────────────────────────────────────────────────
  async getHistory(leadId: string, scope: OrgScope) {
    const lead = await leadRepository.findById(leadId, scope);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }
    return leadRepository.getHistory(leadId);
  }

  // ─── Assignment Recommendations ──────────────────────────────────────
  async getRecommendations(leadId: string, user: JwtPayload) {
    const lead = await leadRepository.findRawById(leadId);
    if (!lead) {
      throw AppError.notFound('Lead not found');
    }

    const isAdmin = user.role === 'admin';
    const eligibleOrgs = await leadRepository.getEligibleOrgs(
      isAdmin ? null : user.sub,
      isAdmin,
    );

    if (eligibleOrgs.length === 0) {
      return { recommendations: [], all_at_capacity: false, no_eligible_orgs: true };
    }

    const orgIds = eligibleOrgs.map((o: any) => o.id);
    const maxTierRank = await leadRepository.getMaxTierRank();
    const leadCounts = await leadRepository.getPartnerLeadCounts(orgIds);

    // Find max load across all eligible orgs
    const maxLoad = Math.max(...Object.values(leadCounts), 0);

    // Score each org
    const scored = eligibleOrgs.map((org: any) => {
      const tierScore = maxTierRank > 0 ? (org.tier_rank / maxTierRank) * 100 : 0;
      const geoScore = this.calculateGeoScore(lead, org);
      const industryScore = this.calculateIndustryScore(lead.industry, org.industry);
      const activeCount = leadCounts[org.id] || 0;
      const loadScore = maxLoad === 0 ? 100 : (1 - activeCount / maxLoad) * 100;

      const compositeScore =
        tierScore * LEAD_ASSIGNMENT_WEIGHTS.tier +
        geoScore * LEAD_ASSIGNMENT_WEIGHTS.geo +
        industryScore * LEAD_ASSIGNMENT_WEIGHTS.industry +
        loadScore * LEAD_ASSIGNMENT_WEIGHTS.load;

      return {
        organization_id: org.id,
        organization_name: org.name,
        tier_name: org.tier_name,
        composite_score: Math.round(compositeScore * 100) / 100,
        scores: {
          tier: Math.round(tierScore * 100) / 100,
          geo: Math.round(geoScore * 100) / 100,
          industry: Math.round(industryScore * 100) / 100,
          load: Math.round(loadScore * 100) / 100,
        },
        active_lead_count: activeCount,
      };
    });

    // Sort by composite score descending
    scored.sort((a: any, b: any) => b.composite_score - a.composite_score);

    // Check capacity
    let allAtCapacity = true;
    for (const org of eligibleOrgs) {
      const count = leadCounts[org.id] || 0;
      const maxCap = LEAD_MAX_ACTIVE_BY_TIER_RANK[org.tier_rank] || 5;
      if (count < maxCap) {
        allAtCapacity = false;
        break;
      }
    }

    return {
      recommendations: scored,
      all_at_capacity: allAtCapacity,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private validateTransition(fromStatus: string, toStatus: string): void {
    const valid = VALID_LEAD_TRANSITIONS[fromStatus] || [];
    if (!valid.includes(toStatus)) {
      throw new AppError(
        `Cannot transition from '${fromStatus}' to '${toStatus}'`,
        422,
        'LEAD_INVALID_TRANSITION',
      );
    }
  }

  private calculateGeoScore(lead: any, org: any): number {
    if (!lead.country || !org.country) return 0;

    // Exact state match
    if (lead.country === org.country && lead.state_province && org.state_province &&
        lead.state_province === org.state_province) {
      return 100;
    }

    // Same country
    if (lead.country === org.country) {
      return 60;
    }

    // Same region
    const leadRegion = this.getRegion(lead.country);
    const orgRegion = this.getRegion(org.country);
    if (leadRegion && orgRegion && leadRegion === orgRegion) {
      return 30;
    }

    return 0;
  }

  private getRegion(country: string): string | null {
    for (const [region, countries] of Object.entries(GEO_REGIONS)) {
      if (countries.includes(country)) {
        return region;
      }
    }
    return null;
  }

  private calculateIndustryScore(leadIndustry: string | null, orgIndustry: string | null): number {
    if (!leadIndustry || !orgIndustry) return 0;

    // Exact match
    if (leadIndustry === orgIndustry) return 100;

    // Check if they are related
    for (const [primary, related] of Object.entries(RELATED_INDUSTRIES)) {
      const group = [primary, ...related];
      if (group.includes(leadIndustry) && group.includes(orgIndustry)) {
        return 50;
      }
    }

    return 0;
  }
}

export default new LeadService();
