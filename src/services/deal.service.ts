import dealRepository, { DealFilters } from '../repositories/deal.repository';
import notificationService from './notification.service';
import organizationService from './organization.service';
import { AppError } from '../utils/AppError';
import { OrgScope, JwtPayload } from '../types/express';
import { VALID_DEAL_TRANSITIONS, DEAL_PROTECTION_DAYS } from '../config/constants';
import db from '../config/database';

class DealService {
  // ─── Create Deal ─────────────────────────────────────────────────────
  async createDeal(data: Record<string, any>, user: JwtPayload) {
    if (!user.org_id) {
      throw AppError.forbidden('User is not associated with an organization', 'AUTH_ORG_MISMATCH');
    }

    const dealData: Record<string, any> = {
      ...data,
      organization_id: user.org_id,
      submitted_by: user.sub,
      status: 'draft',
    };

    const deal = await dealRepository.create(dealData);

    // Insert initial status history: null -> draft
    await dealRepository.insertStatusHistory({
      deal_id: deal.id,
      from_status: null,
      to_status: 'draft',
      changed_by: user.sub,
      notes: 'Deal created',
    });

    // Return with products (empty at creation)
    deal.products = [];
    return deal;
  }

  // ─── Update Deal (draft/rejected only) ──────────────────────────────
  async updateDeal(
    dealId: string,
    data: Record<string, any>,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    // Only draft and rejected can be edited
    if (deal.status !== 'draft' && deal.status !== 'rejected') {
      throw new AppError(
        `Cannot edit deal in '${deal.status}' status. Only draft and rejected deals can be edited.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // partner_rep can only update own deals
    if (user.role === 'partner_rep' && deal.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only update deals you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    const allowed = [
      'customer_company_name', 'customer_contact_name', 'customer_contact_email',
      'customer_contact_phone', 'customer_industry', 'customer_address',
      'deal_name', 'description', 'estimated_value', 'currency',
      'win_probability', 'expected_close_date', 'primary_product_id',
      'source', 'tags',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    if (Object.keys(updates).length === 0) {
      return deal;
    }

    const updated = await dealRepository.updateFields(dealId, updates);
    // Re-fetch with joins
    return dealRepository.findById(dealId, scope);
  }

  // ─── Submit Deal ────────────────────────────────────────────────────
  async submitDeal(dealId: string, user: JwtPayload, scope: OrgScope) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    // partner_rep can only submit own deals
    if (user.role === 'partner_rep' && deal.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only submit deals you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Validate transition
    this.validateTransition(deal.status, 'submitted');

    // Validate required fields for submission
    const missingFields: string[] = [];
    if (!deal.customer_company_name) missingFields.push('customer_company_name');
    if (!deal.deal_name) missingFields.push('deal_name');
    if (!deal.estimated_value || deal.estimated_value <= 0) missingFields.push('estimated_value');
    if (!deal.expected_close_date) missingFields.push('expected_close_date');

    if (missingFields.length > 0) {
      const errors = missingFields.map((field) => ({
        code: 'DEAL_INCOMPLETE',
        message: `Deal cannot be submitted: missing required field '${field}'`,
        field,
      }));
      // Throw a custom error with multiple field errors
      const err: any = new AppError(
        `Deal cannot be submitted: missing required fields: ${missingFields.join(', ')}`,
        422,
        'DEAL_INCOMPLETE',
      );
      err.errors = errors;
      throw err;
    }

    // Run conflict detection
    let conflicts: any[] = [];
    let isConflicting = false;
    let conflictDealId: string | null = null;

    try {
      conflicts = await this.detectConflicts(
        deal.customer_company_name,
        deal.customer_contact_email,
        deal.primary_product_id,
        deal.id,
        deal.organization_id,
      );
      isConflicting = conflicts.length > 0;
      conflictDealId = isConflicting ? conflicts[0].conflicting_deal_id : null;
    } catch (err) {
      // NFR-REL-003: if conflict detection fails, proceed without flagging
      console.error('Conflict detection failed, proceeding without conflict flag:', err);
    }

    // Update deal status
    const updated = await dealRepository.updateStatus(deal.id, deal.status, 'submitted', {
      is_conflicting: isConflicting,
      conflict_deal_id: conflictDealId,
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${deal.status}' to 'submitted'. Deal may have been modified concurrently.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // If resubmitting a rejected deal, clear rejection_reason on next approval
    // (kept in DB until re-approved per US-DR-008)

    // Insert status history
    await dealRepository.insertStatusHistory({
      deal_id: deal.id,
      from_status: deal.status,
      to_status: 'submitted',
      changed_by: user.sub,
      notes: isConflicting ? `Submitted with ${conflicts.length} conflict(s) detected` : 'Submitted for review',
    });

    // Create approval request
    const assignedTo = await this.findApprover(deal.organization_id);
    if (assignedTo) {
      await dealRepository.createApprovalRequest({
        entity_type: 'deal',
        entity_id: deal.id,
        requested_by: user.sub,
        assigned_to: assignedTo,
      });

      // Assign deal to CM
      await dealRepository.updateFields(deal.id, { assigned_to: assignedTo });

      // Notify CM
      const title = isConflicting
        ? `New deal registration with conflicts: ${deal.deal_number}`
        : `New deal registration: ${deal.deal_number}`;

      await notificationService.createNotification({
        user_id: assignedTo,
        type: 'deal_update',
        title,
        body: `${deal.customer_company_name} - ${deal.deal_name} (est. $${deal.estimated_value})`,
        entity_type: 'deal',
        entity_id: deal.id,
        action_url: `/deals/${deal.id}`,
      });
    }

    return {
      id: deal.id,
      deal_number: deal.deal_number,
      status: 'submitted',
      is_conflicting: isConflicting,
      conflict_deal_id: conflictDealId,
      conflicts,
      updated_at: updated.updated_at,
    };
  }

  // ─── Approve Deal ──────────────────────────────────────────────────
  async approveDeal(dealId: string, user: JwtPayload, scope: OrgScope, comments?: string) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    this.validateTransition(deal.status, 'approved');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEAL_PROTECTION_DAYS);

    const updated = await dealRepository.updateStatus(deal.id, deal.status, 'approved', {
      approved_by: user.sub,
      approved_at: new Date(),
      registration_expires_at: expiresAt,
      rejection_reason: null, // clear on approval (US-DR-008)
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${deal.status}' to 'approved'. Deal may have been modified concurrently.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // Insert status history
    await dealRepository.insertStatusHistory({
      deal_id: deal.id,
      from_status: deal.status,
      to_status: 'approved',
      changed_by: user.sub,
      notes: comments || 'Deal approved',
    });

    // Update approval request
    await dealRepository.updateApprovalRequest('deal', deal.id, 'approve', comments);

    // Notify submitter
    await notificationService.createNotification({
      user_id: deal.submitted_by,
      type: 'deal_update',
      title: `Deal ${deal.deal_number} approved - 90-day protection active`,
      body: `Your deal registration has been approved. Protection expires on ${expiresAt.toISOString().slice(0, 10)}.${comments ? ` Comments: ${comments}` : ''}`,
      entity_type: 'deal',
      entity_id: deal.id,
      action_url: `/deals/${deal.id}`,
    });

    return {
      id: deal.id,
      deal_number: deal.deal_number,
      status: 'approved',
      approved_by: user.sub,
      approved_at: updated.approved_at,
      registration_expires_at: updated.registration_expires_at,
      updated_at: updated.updated_at,
    };
  }

  // ─── Reject Deal ──────────────────────────────────────────────────
  async rejectDeal(dealId: string, user: JwtPayload, scope: OrgScope, rejectionReason: string) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    this.validateTransition(deal.status, 'rejected');

    const updated = await dealRepository.updateStatus(deal.id, deal.status, 'rejected', {
      rejection_reason: rejectionReason,
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${deal.status}' to 'rejected'. Deal may have been modified concurrently.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // Insert status history
    await dealRepository.insertStatusHistory({
      deal_id: deal.id,
      from_status: deal.status,
      to_status: 'rejected',
      changed_by: user.sub,
      notes: rejectionReason,
    });

    // Update approval request
    await dealRepository.updateApprovalRequest('deal', deal.id, 'reject', rejectionReason);

    // Notify submitter
    const reasonPreview = rejectionReason.length > 100
      ? rejectionReason.substring(0, 100) + '...'
      : rejectionReason;

    await notificationService.createNotification({
      user_id: deal.submitted_by,
      type: 'deal_update',
      title: `Deal ${deal.deal_number} rejected: ${reasonPreview}`,
      body: `Your deal registration has been rejected. Reason: ${rejectionReason}`,
      entity_type: 'deal',
      entity_id: deal.id,
      action_url: `/deals/${deal.id}`,
    });

    return {
      id: deal.id,
      deal_number: deal.deal_number,
      status: 'rejected',
      rejection_reason: rejectionReason,
      updated_at: updated.updated_at,
    };
  }

  // ─── Mark Won ──────────────────────────────────────────────────────
  async markWon(
    dealId: string,
    user: JwtPayload,
    scope: OrgScope,
    actualValue: number,
    actualCloseDate: string,
  ) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    // partner_rep can only mark own deals
    if (user.role === 'partner_rep' && deal.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only update deals you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    this.validateTransition(deal.status, 'won');

    const updated = await dealRepository.updateStatus(deal.id, deal.status, 'won', {
      actual_value: actualValue,
      actual_close_date: actualCloseDate,
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${deal.status}' to 'won'. Deal may have been modified concurrently.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // Insert status history
    await dealRepository.insertStatusHistory({
      deal_id: deal.id,
      from_status: deal.status,
      to_status: 'won',
      changed_by: user.sub,
      notes: `Deal closed won. Actual value: $${actualValue}`,
    });

    // Update organization YTD metrics
    await db('organizations')
      .where('id', deal.organization_id)
      .increment('ytd_revenue', actualValue)
      .increment('ytd_deals_closed', 1);

    // Trigger tier recalculation
    let tierResult = null;
    try {
      // Use a temporary admin scope to let recalculateTier find the org
      tierResult = await organizationService.recalculateTier(
        deal.organization_id,
        { type: 'all' },
      );
    } catch (err) {
      console.error('Tier recalculation failed after deal won:', err);
    }

    // Notify CM
    const cmId = await this.findApprover(deal.organization_id);
    if (cmId) {
      await notificationService.createNotification({
        user_id: cmId,
        type: 'deal_update',
        title: `Deal ${deal.deal_number} closed won: $${actualValue}`,
        body: `${deal.customer_company_name} - ${deal.deal_name}`,
        entity_type: 'deal',
        entity_id: deal.id,
        action_url: `/deals/${deal.id}`,
      });
    }

    return {
      id: deal.id,
      deal_number: deal.deal_number,
      status: 'won',
      actual_value: actualValue,
      actual_close_date: actualCloseDate,
      updated_at: updated.updated_at,
      tier_recalculation: tierResult,
    };
  }

  // ─── Mark Lost ─────────────────────────────────────────────────────
  async markLost(
    dealId: string,
    user: JwtPayload,
    scope: OrgScope,
    lossReason: string,
  ) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    // partner_rep can only mark own deals
    if (user.role === 'partner_rep' && deal.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only update deals you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    this.validateTransition(deal.status, 'lost');

    // Store loss_reason in custom_fields
    const customFields = deal.custom_fields || {};
    customFields.loss_reason = lossReason;

    const updated = await dealRepository.updateStatus(deal.id, deal.status, 'lost', {
      custom_fields: JSON.stringify(customFields),
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${deal.status}' to 'lost'. Deal may have been modified concurrently.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // Insert status history
    await dealRepository.insertStatusHistory({
      deal_id: deal.id,
      from_status: deal.status,
      to_status: 'lost',
      changed_by: user.sub,
      notes: `Deal lost. Reason: ${lossReason}`,
    });

    return {
      id: deal.id,
      deal_number: deal.deal_number,
      status: 'lost',
      updated_at: updated.updated_at,
    };
  }

  // ─── Get Deal ──────────────────────────────────────────────────────
  async getDeal(dealId: string, scope: OrgScope) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }
    return deal;
  }

  // ─── List Deals ────────────────────────────────────────────────────
  async listDeals(
    scope: OrgScope,
    filters: DealFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return dealRepository.list(scope, filters, pagination, sort);
  }

  // ─── Detect Conflicts ──────────────────────────────────────────────
  async detectConflicts(
    customerCompany: string,
    customerEmail: string | null,
    productId: string | null,
    excludeDealId: string | null = null,
    excludeOrgId: string | null = null,
  ) {
    const rawConflicts = await dealRepository.findConflicts(
      customerCompany,
      customerEmail,
      productId,
      excludeDealId,
    );

    // Filter out same-org deals (CD-6)
    let filtered = rawConflicts;
    if (excludeOrgId) {
      // Need to get org_id for each conflicting deal
      const dealIds = rawConflicts.map((c: any) => c.conflicting_deal_id);
      if (dealIds.length > 0) {
        const dealOrgs = await db('deals')
          .select('id', 'organization_id')
          .whereIn('id', dealIds);
        const orgMap = new Map(dealOrgs.map((d: any) => [d.id, d.organization_id]));
        filtered = rawConflicts.filter(
          (c: any) => orgMap.get(c.conflicting_deal_id) !== excludeOrgId,
        );
      }
    }

    return filtered.map((c: any) => ({
      conflicting_deal_id: c.conflicting_deal_id,
      conflicting_deal_number: c.conflicting_deal_number,
      conflicting_org_name: c.conflicting_org_name,
      match_type: c.match_type,
      similarity_score: parseFloat(c.similarity_score),
    }));
  }

  // ─── Get Conflicts for a Deal ─────────────────────────────────────
  async getConflicts(dealId: string, scope: OrgScope) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    return this.detectConflicts(
      deal.customer_company_name,
      deal.customer_contact_email,
      deal.primary_product_id,
      deal.id,
      deal.organization_id,
    );
  }

  // ─── Conflict Check (pre-submission, no deal needed) ──────────────
  async conflictCheck(
    customerCompany: string,
    customerEmail: string | null,
    productId: string | null,
    user: JwtPayload,
  ) {
    return this.detectConflicts(
      customerCompany,
      customerEmail,
      productId,
      null,
      user.org_id,
    );
  }

  // ─── Get Status History ────────────────────────────────────────────
  async getHistory(dealId: string, scope: OrgScope) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }
    return dealRepository.getStatusHistory(dealId);
  }

  // ─── Add Product ──────────────────────────────────────────────────
  async addProduct(
    dealId: string,
    user: JwtPayload,
    scope: OrgScope,
    productId: string,
    quantity: number,
    unitPrice: number,
    discountPct: number,
  ) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    // partner_rep can only modify own deals
    if (user.role === 'partner_rep' && deal.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only modify deals you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Only draft/rejected deals can have products added
    if (deal.status !== 'draft' && deal.status !== 'rejected') {
      throw new AppError(
        `Cannot modify products on a deal in '${deal.status}' status. Only draft and rejected deals can be modified.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // Validate product exists and is active/available
    const product = await db('products').where('id', productId).first();
    if (!product) {
      throw AppError.notFound('Product not found');
    }
    if (!product.is_active || !product.available_to_partners) {
      throw new AppError(
        'Product is not active or not available to partners',
        422,
        'DEAL_PRODUCT_UNAVAILABLE',
      );
    }

    // Check for duplicate
    const existing = await dealRepository.findDealProduct(dealId, productId);
    if (existing) {
      throw AppError.conflict(
        'This product is already added to the deal',
        'DEAL_DUPLICATE_PRODUCT',
      );
    }

    // Add product
    const dealProduct = await dealRepository.addProduct({
      deal_id: dealId,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      discount_pct: discountPct,
    });

    // Recalculate estimated_value from line totals
    const { sum, count } = await dealRepository.getProductLineTotal(dealId);
    if (count > 0) {
      await dealRepository.updateFields(dealId, { estimated_value: sum });
    }

    // Re-fetch the product row with joined product info
    const products = await dealRepository.getProducts(dealId);
    const addedProduct = products.find((p: any) => p.product_id === productId);

    return {
      ...addedProduct,
      deal_estimated_value: count > 0 ? sum : deal.estimated_value,
    };
  }

  // ─── Remove Product ───────────────────────────────────────────────
  async removeProduct(
    dealId: string,
    productId: string,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const deal = await dealRepository.findById(dealId, scope);
    if (!deal) {
      throw AppError.notFound('Deal not found');
    }

    // partner_rep can only modify own deals
    if (user.role === 'partner_rep' && deal.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only modify deals you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Only draft/rejected deals
    if (deal.status !== 'draft' && deal.status !== 'rejected') {
      throw new AppError(
        `Cannot modify products on a deal in '${deal.status}' status. Only draft and rejected deals can be modified.`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }

    // Check product exists on deal
    const existing = await dealRepository.findDealProduct(dealId, productId);
    if (!existing) {
      throw AppError.notFound('Product not found on this deal');
    }

    await dealRepository.removeProduct(dealId, productId);

    // Recalculate estimated_value only if there are still products (DP-4, DP-10)
    const { sum, count } = await dealRepository.getProductLineTotal(dealId);
    if (count > 0) {
      await dealRepository.updateFields(dealId, { estimated_value: sum });
    }
    // If no products remain, leave estimated_value unchanged

    return { removed: true, deal_estimated_value: count > 0 ? sum : deal.estimated_value };
  }

  // ─── List Expiring Deals ──────────────────────────────────────────
  async listExpiring(
    days: number,
    scope: OrgScope,
    pagination: { offset: number; limit: number },
  ) {
    return dealRepository.findExpiring(days, scope, pagination);
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  private validateTransition(fromStatus: string, toStatus: string): void {
    const valid = VALID_DEAL_TRANSITIONS[fromStatus] || [];
    if (!valid.includes(toStatus)) {
      throw new AppError(
        `Cannot transition from '${fromStatus}' to '${toStatus}'`,
        422,
        'DEAL_INVALID_TRANSITION',
      );
    }
  }

  /**
   * Find the channel manager for an org, or fall back to any admin user.
   */
  private async findApprover(orgId: string): Promise<string | null> {
    // Try org's assigned channel_manager_id
    const org = await db('organizations')
      .select('channel_manager_id')
      .where('id', orgId)
      .first();

    if (org?.channel_manager_id) {
      return org.channel_manager_id;
    }

    // Fallback: any admin user
    const admin = await db('users')
      .select('id')
      .where('role', 'admin')
      .where('is_active', true)
      .first();

    return admin?.id || null;
  }
}

export default new DealService();
