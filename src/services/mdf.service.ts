import mdfRepository, { AllocationFilters, RequestFilters } from '../repositories/mdf.repository';
import notificationService from './notification.service';
import { AppError } from '../utils/AppError';
import { OrgScope, JwtPayload } from '../types/express';
import {
  VALID_MDF_TRANSITIONS,
  MDF_TIER_CAPS,
  MDF_MIN_LEAD_TIME_DAYS,
  MDF_SINGLE_REQUEST_CAP_PCT,
  MDF_TOP_PERFORMER_BONUS_PCT,
  MDF_CLAIM_DEADLINE_DAYS,
} from '../config/constants';
import db from '../config/database';

class MdfService {
  // ═══════════════════════════════════════════════════════════════════════
  // ALLOCATIONS
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Create Allocation ─────────────────────────────────────────────
  async createAllocation(data: Record<string, any>, user: JwtPayload) {
    // Check for duplicate org + year + quarter
    const existing = await mdfRepository.findAllocationByOrgQuarter(
      data.organization_id,
      data.fiscal_year,
      data.fiscal_quarter,
    );

    if (existing) {
      throw AppError.conflict(
        `An MDF allocation already exists for this organization in Q${data.fiscal_quarter} ${data.fiscal_year}`,
        'MDF_ALLOCATION_EXISTS',
      );
    }

    const allocationData: Record<string, any> = {
      organization_id: data.organization_id,
      fiscal_year: data.fiscal_year,
      fiscal_quarter: data.fiscal_quarter,
      allocated_amount: data.allocated_amount,
      spent_amount: 0,
      notes: data.notes || null,
    };

    return mdfRepository.createAllocation(allocationData);
  }

  // ─── List Allocations ──────────────────────────────────────────────
  async listAllocations(
    scope: OrgScope,
    filters: AllocationFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return mdfRepository.listAllocations(scope, filters, pagination, sort);
  }

  // ─── Get Allocation ────────────────────────────────────────────────
  async getAllocation(id: string, scope: OrgScope) {
    const allocation = await mdfRepository.findAllocationById(id, scope);
    if (!allocation) {
      throw AppError.notFound('MDF allocation not found', 'MDF_ALLOCATION_NOT_FOUND');
    }
    return allocation;
  }

  // ─── Update Allocation ─────────────────────────────────────────────
  async updateAllocation(id: string, data: Record<string, any>, scope: OrgScope) {
    const allocation = await mdfRepository.findAllocationById(id, scope);
    if (!allocation) {
      throw AppError.notFound('MDF allocation not found', 'MDF_ALLOCATION_NOT_FOUND');
    }

    // Validate: new allocated_amount >= spent_amount
    if (data.allocated_amount != null) {
      const spent = parseFloat(allocation.spent_amount);
      if (data.allocated_amount < spent) {
        throw new AppError(
          `Cannot reduce allocation below committed amount ($${spent.toFixed(2)} already committed)`,
          422,
          'MDF_ALLOCATION_UNDERFLOW',
        );
      }
    }

    const updates: Record<string, any> = {};
    if (data.allocated_amount != null) updates.allocated_amount = data.allocated_amount;
    if (data.notes !== undefined) updates.notes = data.notes;

    if (Object.keys(updates).length === 0) {
      return allocation;
    }

    return mdfRepository.updateAllocation(id, updates);
  }

  // ─── Auto-Allocate ─────────────────────────────────────────────────
  async autoAllocate(fiscalYear: number, fiscalQuarter: number) {
    const orgs = await mdfRepository.getActiveOrgsWithTier();

    const quarterStart = this.getQuarterStartDate(fiscalYear, fiscalQuarter);

    const summary = {
      created: 0,
      skipped_existing: 0,
      skipped_no_revenue: 0,
      skipped_no_mdf_tier: 0,
      details: [] as any[],
    };

    for (const org of orgs) {
      const tierName = org.tier_name as string;
      const mdfBudgetPct = parseFloat(org.mdf_budget_pct);
      const tierCap = MDF_TIER_CAPS[tierName] ?? 0;

      // Step 1: Check tier eligibility
      if (mdfBudgetPct === 0 || tierCap === 0) {
        summary.skipped_no_mdf_tier++;
        summary.details.push({
          org_id: org.org_id,
          org_name: org.org_name,
          tier_name: tierName,
          status: 'skipped_no_mdf_tier',
        });
        continue;
      }

      // Step 2: Check for existing allocation
      const existing = await mdfRepository.findAllocationByOrgQuarter(
        org.org_id,
        fiscalYear,
        fiscalQuarter,
      );
      if (existing) {
        summary.skipped_existing++;
        summary.details.push({
          org_id: org.org_id,
          org_name: org.org_name,
          tier_name: tierName,
          status: 'skipped_existing',
        });
        continue;
      }

      // Step 3: Get trailing revenue
      const trailingRevenue = await mdfRepository.getTrailingRevenue(org.org_id, quarterStart);
      if (trailingRevenue === 0) {
        summary.skipped_no_revenue++;
        summary.details.push({
          org_id: org.org_id,
          org_name: org.org_name,
          tier_name: tierName,
          trailing_revenue: 0,
          status: 'skipped_no_revenue',
        });
        continue;
      }

      // Step 4: Base allocation
      const baseAllocation = trailingRevenue * (mdfBudgetPct / 100);

      // Step 5: Apply tier cap
      const cappedAllocation = Math.min(baseAllocation, tierCap);

      // Step 6: Top performer bonus
      const threshold = await mdfRepository.getTopPerformerThreshold(org.tier_id, quarterStart);
      const isTopPerformer = trailingRevenue >= threshold;
      const withBonus = isTopPerformer
        ? cappedAllocation * (1 + MDF_TOP_PERFORMER_BONUS_PCT / 100)
        : cappedAllocation;

      // Step 7: Re-apply tier cap after bonus
      const finalAllocation = Math.round(Math.min(withBonus, tierCap) * 100) / 100;

      // Step 8: Create allocation
      await mdfRepository.createAllocation({
        organization_id: org.org_id,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        allocated_amount: finalAllocation,
        spent_amount: 0,
        notes: `Auto-calculated: ${mdfBudgetPct}% of $${trailingRevenue.toLocaleString()} trailing revenue${isTopPerformer ? ' (includes 20% top performer bonus)' : ''}`,
      });

      summary.created++;
      summary.details.push({
        org_id: org.org_id,
        org_name: org.org_name,
        tier_name: tierName,
        trailing_revenue: trailingRevenue,
        base_allocation: baseAllocation,
        is_top_performer: isTopPerformer,
        final_allocation: finalAllocation,
        status: 'created',
      });
    }

    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Create Request (Draft) ────────────────────────────────────────
  async createRequest(data: Record<string, any>, user: JwtPayload) {
    if (!user.org_id) {
      throw AppError.forbidden('User is not associated with an organization', 'AUTH_ORG_MISMATCH');
    }

    // Validate allocation exists and belongs to user's org
    const allocation = await mdfRepository.findAllocationById(data.allocation_id, {
      type: 'own',
      organizationId: user.org_id,
    });

    if (!allocation) {
      throw AppError.notFound('MDF allocation not found', 'MDF_ALLOCATION_NOT_FOUND');
    }

    const requestData: Record<string, any> = {
      allocation_id: data.allocation_id,
      organization_id: user.org_id,
      submitted_by: user.sub,
      activity_type: data.activity_type,
      activity_name: data.activity_name,
      description: data.description || null,
      start_date: data.start_date,
      end_date: data.end_date,
      requested_amount: data.requested_amount,
      status: 'draft',
    };

    return mdfRepository.createRequest(requestData);
  }

  // ─── Update Request ────────────────────────────────────────────────
  async updateRequest(
    id: string,
    data: Record<string, any>,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    if (request.status !== 'draft' && request.status !== 'rejected') {
      throw new AppError(
        'Request can only be edited in draft or rejected status',
        422,
        'MDF_NOT_EDITABLE',
      );
    }

    // Only the submitter can edit
    if (request.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only edit requests you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    const allowed = [
      'activity_type', 'activity_name', 'description',
      'start_date', 'end_date', 'requested_amount',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    if (Object.keys(updates).length === 0) {
      return request;
    }

    return mdfRepository.updateRequestFields(id, updates);
  }

  // ─── List Requests ─────────────────────────────────────────────────
  async listRequests(
    scope: OrgScope,
    filters: RequestFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return mdfRepository.listRequests(scope, filters, pagination, sort);
  }

  // ─── Get Request ───────────────────────────────────────────────────
  async getRequest(id: string, scope: OrgScope) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }
    return request;
  }

  // ─── Submit Request ────────────────────────────────────────────────
  async submitRequest(id: string, user: JwtPayload, scope: OrgScope) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    // Only submitter can submit
    if (request.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only submit requests you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Validate transition
    this.validateTransition(request.status, 'submitted');

    // Validate lead time: start_date >= today + 14 days
    const minStartDate = new Date();
    minStartDate.setDate(minStartDate.getDate() + MDF_MIN_LEAD_TIME_DAYS);
    const startDate = new Date(request.start_date);
    if (startDate < minStartDate) {
      throw new AppError(
        'Activity start date must be at least 14 days from today',
        422,
        'MDF_ACTIVITY_TOO_SOON',
      );
    }

    // Use transaction for concurrency safety
    const result = await db.transaction(async (trx) => {
      // Lock allocation row
      const allocation = await mdfRepository.findAllocationForUpdate(request.allocation_id, trx);
      if (!allocation) {
        throw AppError.notFound('MDF allocation not found', 'MDF_ALLOCATION_NOT_FOUND');
      }

      const remaining = parseFloat(allocation.remaining_amount);
      const requestedAmount = parseFloat(request.requested_amount);
      const allocatedAmount = parseFloat(allocation.allocated_amount);

      // Validate sufficient funds
      if (requestedAmount > remaining) {
        throw new AppError(
          `Requested amount ($${requestedAmount.toFixed(2)}) exceeds remaining allocation ($${remaining.toFixed(2)})`,
          422,
          'MDF_INSUFFICIENT_FUNDS',
        );
      }

      // Validate single request cap (50% of allocation)
      const cap = allocatedAmount * (MDF_SINGLE_REQUEST_CAP_PCT / 100);
      if (requestedAmount > cap) {
        throw new AppError(
          `Single request cannot exceed 50% of quarterly allocation (max: $${cap.toFixed(2)})`,
          422,
          'MDF_REQUEST_EXCEEDS_CAP',
        );
      }

      // Transition status (do NOT adjust spent_amount -- only on approval)
      const updated = await mdfRepository.updateRequestStatusTrx(
        id,
        request.status,
        'submitted',
        {},
        trx,
      );

      if (!updated) {
        throw new AppError(
          `Cannot transition from '${request.status}' to 'submitted'. Request may have been modified concurrently.`,
          422,
          'MDF_INVALID_TRANSITION',
        );
      }

      return updated;
    });

    // Create approval request for CM
    const assignedTo = await this.findApprover(request.organization_id);
    if (assignedTo) {
      await mdfRepository.createApprovalRequest({
        entity_type: 'mdf_request',
        entity_id: id,
        requested_by: user.sub,
        assigned_to: assignedTo,
      });

      // Notify CM
      await notificationService.createNotification({
        user_id: assignedTo,
        type: 'mdf_update',
        title: `MDF Request ${request.request_number} from ${request.organization_name}`,
        body: `${request.activity_name} - $${parseFloat(request.requested_amount).toLocaleString()} requested`,
        entity_type: 'mdf_request',
        entity_id: id,
        action_url: `/mdf/requests/${id}`,
      });
    }

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'submitted',
      updated_at: result.updated_at,
    };
  }

  // ─── Approve Request ───────────────────────────────────────────────
  async approveRequest(
    id: string,
    body: { approved_amount?: number; comments?: string },
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    this.validateTransition(request.status, 'approved');

    const requestedAmount = parseFloat(request.requested_amount);
    const approvedAmount = body.approved_amount ?? requestedAmount;

    // Validate approved_amount <= requested_amount
    if (approvedAmount > requestedAmount) {
      throw new AppError(
        'Approved amount cannot exceed requested amount',
        422,
        'MDF_AMOUNT_EXCEEDS_REQUESTED',
      );
    }

    if (approvedAmount <= 0) {
      throw AppError.badRequest('Approved amount must be greater than 0', 'MDF_INVALID_AMOUNT');
    }

    // Use transaction: lock allocation, validate funds, commit
    const result = await db.transaction(async (trx) => {
      // Lock allocation
      const allocation = await mdfRepository.findAllocationForUpdate(request.allocation_id, trx);
      if (!allocation) {
        throw AppError.notFound('MDF allocation not found', 'MDF_ALLOCATION_NOT_FOUND');
      }

      const remaining = parseFloat(allocation.remaining_amount);
      if (approvedAmount > remaining) {
        throw new AppError(
          `Requested amount ($${approvedAmount.toFixed(2)}) exceeds remaining allocation ($${remaining.toFixed(2)})`,
          422,
          'MDF_INSUFFICIENT_FUNDS',
        );
      }

      // Increment spent_amount
      await mdfRepository.adjustSpentAmount(request.allocation_id, approvedAmount, trx);

      // Update request status
      const updated = await mdfRepository.updateRequestStatusTrx(
        id,
        request.status,
        'approved',
        {
          approved_amount: approvedAmount,
          reviewed_by: user.sub,
          reviewed_at: new Date(),
        },
        trx,
      );

      if (!updated) {
        throw new AppError(
          `Cannot transition from '${request.status}' to 'approved'. Request may have been modified concurrently.`,
          422,
          'MDF_INVALID_TRANSITION',
        );
      }

      return updated;
    });

    // Update approval request
    await mdfRepository.updateApprovalRequest('mdf_request', id, 'approve', body.comments);

    // Notify submitter
    const isPartial = approvedAmount < requestedAmount;
    const title = isPartial
      ? `MDF Request ${request.request_number} Partially Approved`
      : `MDF Request ${request.request_number} Approved`;

    const bodyText = isPartial
      ? `Approved for $${approvedAmount.toLocaleString()} (requested: $${requestedAmount.toLocaleString()}).${body.comments ? ` Notes: ${body.comments}` : ''}`
      : `Your MDF request has been approved for $${approvedAmount.toLocaleString()}.${body.comments ? ` Notes: ${body.comments}` : ''}`;

    await notificationService.createNotification({
      user_id: request.submitted_by,
      type: 'mdf_update',
      title,
      body: bodyText,
      entity_type: 'mdf_request',
      entity_id: id,
      action_url: `/mdf/requests/${id}`,
    });

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'approved',
      approved_amount: approvedAmount,
      reviewed_by: user.sub,
      reviewed_at: result.reviewed_at,
      updated_at: result.updated_at,
    };
  }

  // ─── Reject Request ────────────────────────────────────────────────
  async rejectRequest(
    id: string,
    body: { rejection_reason: string },
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    this.validateTransition(request.status, 'rejected');

    const updated = await mdfRepository.updateRequestStatus(id, request.status, 'rejected', {
      rejection_reason: body.rejection_reason,
      reviewed_by: user.sub,
      reviewed_at: new Date(),
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${request.status}' to 'rejected'. Request may have been modified concurrently.`,
        422,
        'MDF_INVALID_TRANSITION',
      );
    }

    // Update approval request
    await mdfRepository.updateApprovalRequest('mdf_request', id, 'reject', body.rejection_reason);

    // Notify submitter
    await notificationService.createNotification({
      user_id: request.submitted_by,
      type: 'mdf_update',
      title: `MDF Request ${request.request_number} Rejected`,
      body: `Reason: ${body.rejection_reason}`,
      entity_type: 'mdf_request',
      entity_id: id,
      action_url: `/mdf/requests/${id}`,
    });

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'rejected',
      rejection_reason: body.rejection_reason,
      updated_at: updated.updated_at,
    };
  }

  // ─── Complete Activity ─────────────────────────────────────────────
  async completeActivity(id: string, user: JwtPayload, scope: OrgScope) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    // Only submitter can mark complete
    if (request.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only complete activities you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    this.validateTransition(request.status, 'completed');

    const updated = await mdfRepository.updateRequestStatus(id, request.status, 'completed', {});

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${request.status}' to 'completed'. Request may have been modified concurrently.`,
        422,
        'MDF_INVALID_TRANSITION',
      );
    }

    // Calculate claim deadline
    const endDate = new Date(request.end_date);
    const claimDeadline = new Date(endDate);
    claimDeadline.setDate(claimDeadline.getDate() + MDF_CLAIM_DEADLINE_DAYS);

    // Notify partner about claim window
    await notificationService.createNotification({
      user_id: request.submitted_by,
      type: 'mdf_update',
      title: `Activity Completed: ${request.request_number}`,
      body: `Please submit your claim with proof of execution by ${claimDeadline.toISOString().slice(0, 10)} (60 days from activity end date).`,
      entity_type: 'mdf_request',
      entity_id: id,
      action_url: `/mdf/requests/${id}`,
    });

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'completed',
      claim_deadline: claimDeadline.toISOString().slice(0, 10),
      updated_at: updated.updated_at,
    };
  }

  // ─── Submit Claim ──────────────────────────────────────────────────
  async submitClaim(
    id: string,
    body: { claim_amount: number; claim_notes?: string; proof_of_execution: string[] },
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    // Only submitter can submit claim
    if (request.submitted_by !== user.sub) {
      throw AppError.forbidden('You can only submit claims for requests you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    this.validateTransition(request.status, 'claim_submitted');

    // Validate claim_amount <= approved_amount
    const approvedAmount = parseFloat(request.approved_amount);
    if (body.claim_amount > approvedAmount) {
      throw new AppError(
        `Claim amount ($${body.claim_amount.toFixed(2)}) cannot exceed approved amount ($${approvedAmount.toFixed(2)})`,
        422,
        'MDF_CLAIM_EXCEEDS_APPROVED',
      );
    }

    // Validate within 60-day deadline
    const endDate = new Date(request.end_date);
    const deadline = new Date(endDate);
    deadline.setDate(deadline.getDate() + MDF_CLAIM_DEADLINE_DAYS);
    const now = new Date();

    if (now > deadline) {
      throw new AppError(
        `Claim deadline has passed (deadline was ${deadline.toISOString().slice(0, 10)})`,
        422,
        'MDF_DEADLINE_PASSED',
      );
    }

    // Validate proof
    if (!body.proof_of_execution || body.proof_of_execution.length === 0) {
      throw new AppError(
        'At least one proof of execution document is required',
        422,
        'MDF_PROOF_REQUIRED',
      );
    }

    const updated = await mdfRepository.updateRequestStatus(id, request.status, 'claim_submitted', {
      claim_amount: body.claim_amount,
      claim_notes: body.claim_notes || null,
      proof_of_execution: body.proof_of_execution,
      claim_submitted_at: new Date(),
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${request.status}' to 'claim_submitted'. Request may have been modified concurrently.`,
        422,
        'MDF_INVALID_TRANSITION',
      );
    }

    // Notify CM
    const cmId = await this.findApprover(request.organization_id);
    if (cmId) {
      await notificationService.createNotification({
        user_id: cmId,
        type: 'mdf_update',
        title: `MDF Claim for ${request.request_number}`,
        body: `Claim for $${body.claim_amount.toLocaleString()} with ${body.proof_of_execution.length} proof documents.`,
        entity_type: 'mdf_request',
        entity_id: id,
        action_url: `/mdf/requests/${id}`,
      });
    }

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'claim_submitted',
      claim_amount: body.claim_amount,
      updated_at: updated.updated_at,
    };
  }

  // ─── Approve Claim ─────────────────────────────────────────────────
  async approveClaim(
    id: string,
    body: { reimbursement_amount?: number; comments?: string },
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    this.validateTransition(request.status, 'claim_approved');

    const claimAmount = parseFloat(request.claim_amount);
    const reimbursementAmount = body.reimbursement_amount ?? claimAmount;

    if (reimbursementAmount <= 0) {
      throw AppError.badRequest('Reimbursement amount must be greater than 0', 'MDF_INVALID_AMOUNT');
    }

    const updated = await mdfRepository.updateRequestStatus(id, request.status, 'claim_approved', {
      reimbursement_amount: reimbursementAmount,
      reviewed_by: user.sub,
      reviewed_at: new Date(),
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${request.status}' to 'claim_approved'. Request may have been modified concurrently.`,
        422,
        'MDF_INVALID_TRANSITION',
      );
    }

    // Notify submitter
    await notificationService.createNotification({
      user_id: request.submitted_by,
      type: 'mdf_update',
      title: `MDF Claim Approved: ${request.request_number}`,
      body: `Reimbursement of $${reimbursementAmount.toLocaleString()} approved.${body.comments ? ` Notes: ${body.comments}` : ''}`,
      entity_type: 'mdf_request',
      entity_id: id,
      action_url: `/mdf/requests/${id}`,
    });

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'claim_approved',
      reimbursement_amount: reimbursementAmount,
      updated_at: updated.updated_at,
    };
  }

  // ─── Reject Claim ──────────────────────────────────────────────────
  async rejectClaim(
    id: string,
    body: { rejection_reason: string },
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    this.validateTransition(request.status, 'claim_rejected');

    const updated = await mdfRepository.updateRequestStatus(id, request.status, 'claim_rejected', {
      rejection_reason: body.rejection_reason,
      reviewed_by: user.sub,
      reviewed_at: new Date(),
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${request.status}' to 'claim_rejected'. Request may have been modified concurrently.`,
        422,
        'MDF_INVALID_TRANSITION',
      );
    }

    // Notify submitter
    await notificationService.createNotification({
      user_id: request.submitted_by,
      type: 'mdf_update',
      title: `MDF Claim Rejected: ${request.request_number}`,
      body: `Reason: ${body.rejection_reason}. You may resubmit with updated proof.`,
      entity_type: 'mdf_request',
      entity_id: id,
      action_url: `/mdf/requests/${id}`,
    });

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'claim_rejected',
      rejection_reason: body.rejection_reason,
      updated_at: updated.updated_at,
    };
  }

  // ─── Mark Reimbursed ───────────────────────────────────────────────
  async markReimbursed(
    id: string,
    body: { comments?: string },
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    this.validateTransition(request.status, 'reimbursed');

    const updated = await mdfRepository.updateRequestStatus(id, request.status, 'reimbursed', {
      reimbursed_at: new Date(),
    });

    if (!updated) {
      throw new AppError(
        `Cannot transition from '${request.status}' to 'reimbursed'. Request may have been modified concurrently.`,
        422,
        'MDF_INVALID_TRANSITION',
      );
    }

    // Notify submitter
    const reimbursementAmount = parseFloat(request.reimbursement_amount);
    await notificationService.createNotification({
      user_id: request.submitted_by,
      type: 'mdf_update',
      title: `MDF Reimbursement: ${request.request_number}`,
      body: `Reimbursement of $${reimbursementAmount.toLocaleString()} has been processed.${body.comments ? ` Notes: ${body.comments}` : ''}`,
      entity_type: 'mdf_request',
      entity_id: id,
      action_url: `/mdf/requests/${id}`,
    });

    return {
      id: request.id,
      request_number: request.request_number,
      status: 'reimbursed',
      reimbursement_amount: reimbursementAmount,
      reimbursed_at: updated.reimbursed_at,
      updated_at: updated.updated_at,
    };
  }

  // ─── Get Request History ───────────────────────────────────────────
  async getRequestHistory(id: string, scope: OrgScope) {
    const request = await mdfRepository.findRequestById(id, scope);
    if (!request) {
      throw AppError.notFound('MDF request not found', 'MDF_REQUEST_NOT_FOUND');
    }

    // Query activity feed for this request
    const history = await db('activity_feed')
      .where('entity_type', 'mdf_request')
      .where('entity_id', id)
      .orderBy('created_at', 'asc')
      .select('*');

    return history;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private validateTransition(fromStatus: string, toStatus: string): void {
    const valid = VALID_MDF_TRANSITIONS[fromStatus] || [];
    if (!valid.includes(toStatus)) {
      throw new AppError(
        `Cannot transition from '${fromStatus}' to '${toStatus}'`,
        422,
        'MDF_INVALID_TRANSITION',
      );
    }
  }

  private getQuarterStartDate(year: number, quarter: number): Date {
    const month = (quarter - 1) * 3; // Q1=0(Jan), Q2=3(Apr), Q3=6(Jul), Q4=9(Oct)
    return new Date(year, month, 1);
  }

  /**
   * Find the channel manager for an org, or fall back to any admin user.
   */
  private async findApprover(orgId: string): Promise<string | null> {
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

export default new MdfService();
