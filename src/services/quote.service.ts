import quoteRepository, { QuoteFilters } from '../repositories/quote.repository';
import notificationService from './notification.service';
import { AppError } from '../utils/AppError';
import { OrgScope, JwtPayload } from '../types/express';
import {
  VALID_QUOTE_TRANSITIONS,
  QUOTE_VALIDITY_DAYS,
  DISCOUNT_CM_BUFFER_PCT,
  ALLOWED_QUOTE_CREATION_DEAL_STATUSES,
} from '../config/constants';
import db from '../config/database';
import { Knex } from 'knex';

interface PricingResult {
  list_price: number;
  volume_discount_pct: number;
  tier_discount_pct: number;
  tier_discounted_price: number;
  partner_discount_type: string;
  partner_discount_value: number;
  partner_discount_amount: number;
  unit_price: number;
}

interface DiscountEvaluation {
  approved: boolean;
  level: 'auto' | 'channel_manager' | 'admin';
  ceiling: number | null;
  effective_discount_pct: number;
}

class QuoteService {
  // ─── Create Quote ──────────────────────────────────────────────────
  async createQuote(data: Record<string, any>, user: JwtPayload) {
    if (!user.org_id) {
      throw AppError.forbidden('User is not associated with an organization', 'AUTH_ORG_MISMATCH');
    }

    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);

    const quoteData: Record<string, any> = {
      organization_id: user.org_id,
      created_by: user.sub,
      status: 'draft',
      customer_name: data.customer_name,
      customer_email: data.customer_email || null,
      valid_from: data.valid_from || now.toISOString().slice(0, 10),
      valid_until: data.valid_until || validUntil.toISOString().slice(0, 10),
      payment_terms: data.payment_terms || 'Net 30',
      notes: data.notes || null,
      terms_and_conditions: data.terms_and_conditions || null,
      tax_amount: data.tax_amount || 0,
      subtotal: 0,
      total_discount: 0,
      total_amount: data.tax_amount || 0,
      requires_approval: false,
    };

    // If creating from a deal, pre-populate customer info
    if (data.deal_id) {
      const scope: OrgScope = { type: 'own', organizationId: user.org_id };
      const deal = await quoteRepository.findDeal(data.deal_id, scope);

      if (!deal) {
        throw AppError.notFound('Deal not found');
      }

      if (!ALLOWED_QUOTE_CREATION_DEAL_STATUSES.includes(deal.status)) {
        throw new AppError(
          `Cannot create quote from a deal in '${deal.status}' status. Deal must be approved or won.`,
          422,
          'QUOTE_DEAL_INVALID_STATUS',
        );
      }

      quoteData.deal_id = deal.id;
      quoteData.customer_name = data.customer_name || deal.customer_company_name;
      quoteData.customer_email = data.customer_email || deal.customer_contact_email || null;
    }

    if (!quoteData.customer_name) {
      throw AppError.validation('customer_name is required when not creating from a deal', 'customer_name');
    }

    const quote = await quoteRepository.create(quoteData);

    // Insert initial status history
    await quoteRepository.insertStatusHistory({
      quote_id: quote.id,
      from_status: null,
      to_status: 'draft',
      changed_by: user.sub,
      notes: data.deal_id ? `Quote created from deal` : 'Quote created',
    });

    quote.line_items = [];
    return quote;
  }

  // ─── Update Quote Header ──────────────────────────────────────────
  async updateQuote(
    quoteId: string,
    data: Record<string, any>,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      throw new AppError(
        `Cannot modify a quote in '${quote.status}' status. Clone the quote to create an editable copy.`,
        422,
        'QUOTE_INVALID_TRANSITION',
      );
    }

    // partner_rep can only update own quotes
    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only update quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    const allowed = [
      'customer_name', 'customer_email', 'valid_from', 'valid_until',
      'payment_terms', 'notes', 'terms_and_conditions', 'tax_amount',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    if (Object.keys(updates).length === 0) {
      return quote;
    }

    // If tax_amount changed, recalculate total_amount
    if (updates.tax_amount !== undefined) {
      const { totalAfterDiscounts } = await quoteRepository.getLineTotals(quoteId);
      updates.total_amount = totalAfterDiscounts + (updates.tax_amount || 0);
    }

    await quoteRepository.updateFields(quoteId, updates);
    return quoteRepository.findById(quoteId, scope);
  }

  // ─── Delete Quote ─────────────────────────────────────────────────
  async deleteQuote(quoteId: string, user: JwtPayload, scope: OrgScope) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    if (quote.status !== 'draft') {
      throw new AppError(
        `Cannot delete a quote in '${quote.status}' status. Only draft quotes can be deleted.`,
        422,
        'QUOTE_INVALID_TRANSITION',
      );
    }

    // partner_rep can only delete own quotes
    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only delete quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    await quoteRepository.deleteQuote(quoteId);
    return { deleted: true };
  }

  // ─── Get Quote ────────────────────────────────────────────────────
  async getQuote(quoteId: string, scope: OrgScope) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }
    return quote;
  }

  // ─── List Quotes ─────────────────────────────────────────────────
  async listQuotes(
    scope: OrgScope,
    filters: QuoteFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return quoteRepository.list(scope, filters, pagination, sort);
  }

  // ─── Add Line Item ───────────────────────────────────────────────
  async addLine(
    quoteId: string,
    data: Record<string, any>,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      throw new AppError(
        `Cannot modify a quote in '${quote.status}' status. Clone the quote to create an editable copy.`,
        422,
        'QUOTE_INVALID_TRANSITION',
      );
    }

    // partner_rep can only modify own quotes
    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only modify quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Validate product
    const product = await quoteRepository.findProduct(data.product_id);
    if (!product) {
      throw AppError.notFound('Product not found');
    }
    if (!product.is_active || !product.available_to_partners) {
      throw new AppError(
        'Product is not active or not available to partners',
        422,
        'PRODUCT_UNAVAILABLE',
      );
    }

    // Get org tier info
    const org = await quoteRepository.findOrganization(quote.organization_id);
    const tierId = org.tier_id;

    return quoteRepository.transaction(async (trx) => {
      // Calculate pricing
      const pricing = await this.calculateLinePrice(
        data.product_id,
        tierId,
        data.discount_type || 'percentage',
        data.discount_value || 0,
        data.quantity,
      );

      // Evaluate discount
      const discountEval = await this.evaluateDiscount(
        pricing.list_price,
        pricing.unit_price,
        tierId,
        data.product_id,
      );

      // Insert line item
      const lineData: Record<string, any> = {
        quote_id: quoteId,
        product_id: data.product_id,
        sort_order: data.sort_order || 0,
        quantity: data.quantity,
        list_price: pricing.list_price,
        discount_type: data.discount_type || 'percentage',
        discount_value: data.discount_value || 0,
        unit_price: pricing.unit_price,
        discount_approved: discountEval.approved,
        notes: data.notes || null,
      };

      const line = await quoteRepository.addLine(lineData, trx);

      // Recalculate quote totals
      await this.updateQuoteTotals(quoteId, trx);

      // Update requires_approval flag
      const hasUnapproved = await quoteRepository.hasUnapprovedLines(quoteId, trx);
      await quoteRepository.updateFields(quoteId, { requires_approval: hasUnapproved }, trx);

      // Fetch the line with product info for response
      const lines = await quoteRepository.getLines(quoteId, trx);
      const addedLine = lines.find((l: any) => l.id === line.id);

      return {
        ...addedLine,
        tier_discount_pct: pricing.tier_discount_pct,
        partner_discount_pct: data.discount_type === 'percentage' ? data.discount_value : null,
        effective_discount_pct: discountEval.effective_discount_pct,
      };
    });
  }

  // ─── Update Line Item ────────────────────────────────────────────
  async updateLine(
    quoteId: string,
    lineId: string,
    data: Record<string, any>,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      throw new AppError(
        `Cannot modify a quote in '${quote.status}' status. Clone the quote to create an editable copy.`,
        422,
        'QUOTE_INVALID_TRANSITION',
      );
    }

    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only modify quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    const existingLine = await quoteRepository.findLineById(lineId);
    if (!existingLine || existingLine.quote_id !== quoteId) {
      throw AppError.notFound('Line item not found on this quote');
    }

    const org = await quoteRepository.findOrganization(quote.organization_id);
    const tierId = org.tier_id;

    return quoteRepository.transaction(async (trx) => {
      const quantity = data.quantity ?? existingLine.quantity;
      const discountType = data.discount_type ?? existingLine.discount_type;
      const discountValue = data.discount_value ?? existingLine.discount_value;

      // Re-run pricing waterfall with existing list_price (snapshot preserved)
      const pricing = await this.calculateLinePriceFromSnapshot(
        existingLine.product_id,
        parseFloat(existingLine.list_price),
        tierId,
        discountType,
        discountValue,
        quantity,
      );

      // Re-evaluate discount
      const discountEval = await this.evaluateDiscount(
        parseFloat(existingLine.list_price),
        pricing.unit_price,
        tierId,
        existingLine.product_id,
      );

      const updateData: Record<string, any> = {
        unit_price: pricing.unit_price,
        discount_approved: discountEval.approved,
      };

      if (data.quantity !== undefined) updateData.quantity = data.quantity;
      if (data.discount_type !== undefined) updateData.discount_type = data.discount_type;
      if (data.discount_value !== undefined) updateData.discount_value = data.discount_value;
      if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
      if (data.notes !== undefined) updateData.notes = data.notes;

      // If discount changed and was previously approved by someone, reset approver
      if (data.discount_value !== undefined || data.discount_type !== undefined) {
        if (!discountEval.approved) {
          updateData.discount_approved_by = null;
        }
      }

      await quoteRepository.updateLine(lineId, updateData, trx);

      // Recalculate quote totals
      await this.updateQuoteTotals(quoteId, trx);

      // Update requires_approval
      const hasUnapproved = await quoteRepository.hasUnapprovedLines(quoteId, trx);
      await quoteRepository.updateFields(quoteId, { requires_approval: hasUnapproved }, trx);

      // Fetch updated line with product info
      const lines = await quoteRepository.getLines(quoteId, trx);
      const updatedLine = lines.find((l: any) => l.id === lineId);

      return {
        ...updatedLine,
        tier_discount_pct: pricing.tier_discount_pct,
        effective_discount_pct: discountEval.effective_discount_pct,
      };
    });
  }

  // ─── Remove Line Item ────────────────────────────────────────────
  async removeLine(
    quoteId: string,
    lineId: string,
    user: JwtPayload,
    scope: OrgScope,
  ) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      throw new AppError(
        `Cannot modify a quote in '${quote.status}' status. Clone the quote to create an editable copy.`,
        422,
        'QUOTE_INVALID_TRANSITION',
      );
    }

    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only modify quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    const existingLine = await quoteRepository.findLineById(lineId);
    if (!existingLine || existingLine.quote_id !== quoteId) {
      throw AppError.notFound('Line item not found on this quote');
    }

    return quoteRepository.transaction(async (trx) => {
      await quoteRepository.removeLine(lineId, trx);

      // Recalculate quote totals
      await this.updateQuoteTotals(quoteId, trx);

      // Re-evaluate requires_approval
      const hasUnapproved = await quoteRepository.hasUnapprovedLines(quoteId, trx);
      await quoteRepository.updateFields(quoteId, { requires_approval: hasUnapproved }, trx);

      return { removed: true };
    });
  }

  // ─── Submit Quote ─────────────────────────────────────────────────
  async submitQuote(quoteId: string, user: JwtPayload, scope: OrgScope) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only submit quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Validate current status allows submit
    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      this.validateTransition(quote.status, 'pending_approval');
    }

    // Must have at least 1 line item
    if (!quote.line_items || quote.line_items.length === 0) {
      throw new AppError(
        'Quote must have at least one line item before submission',
        422,
        'QUOTE_INCOMPLETE',
      );
    }

    // Check valid_until >= today
    const today = new Date().toISOString().slice(0, 10);
    if (quote.valid_until && quote.valid_until < today) {
      throw new AppError(
        'Quote validity period has expired. Please update valid_until before submitting.',
        422,
        'QUOTE_INCOMPLETE',
      );
    }

    return quoteRepository.transaction(async (trx) => {
      if (!quote.requires_approval) {
        // Auto-approve: draft/rejected -> approved
        const toStatus = 'approved';
        const updated = await quoteRepository.updateStatus(quote.id, quote.status, toStatus, {
          approved_at: new Date(),
          approved_by: null, // auto-approved
          rejection_reason: null,
          requires_approval: false,
        }, trx);

        if (!updated) {
          throw new AppError(
            'Quote was modified by another user. Please refresh and try again.',
            409,
            'QUOTE_CONCURRENT_MODIFICATION',
          );
        }

        await quoteRepository.insertStatusHistory({
          quote_id: quote.id,
          from_status: quote.status,
          to_status: toStatus,
          changed_by: user.sub,
          notes: 'Auto-approved: all discounts within tier threshold',
        }, trx);

        // Notify creator
        await notificationService.createNotification({
          user_id: quote.created_by,
          type: 'quote_approval',
          title: `Quote ${quote.quote_number} auto-approved`,
          body: `Your quote for ${quote.customer_name} ($${quote.total_amount}) has been auto-approved.`,
          entity_type: 'quote',
          entity_id: quote.id,
          action_url: `/quotes/${quote.id}`,
        });

        return {
          id: quote.id,
          quote_number: quote.quote_number,
          status: 'approved',
          auto_approved: true,
          updated_at: updated.updated_at,
        };
      } else {
        // Requires approval: draft/rejected -> pending_approval
        const toStatus = 'pending_approval';
        const updated = await quoteRepository.updateStatus(quote.id, quote.status, toStatus, {
          rejection_reason: null,
        }, trx);

        if (!updated) {
          throw new AppError(
            'Quote was modified by another user. Please refresh and try again.',
            409,
            'QUOTE_CONCURRENT_MODIFICATION',
          );
        }

        await quoteRepository.insertStatusHistory({
          quote_id: quote.id,
          from_status: quote.status,
          to_status: toStatus,
          changed_by: user.sub,
          notes: 'Submitted for discount approval',
        }, trx);

        // Determine approval level
        const approvalLevel = await this.getHighestApprovalLevel(quote.id, quote.organization_id);

        // Find approver
        const assignedTo = await this.findApprover(quote.organization_id, approvalLevel);
        if (assignedTo) {
          await quoteRepository.createApprovalRequest({
            entity_type: 'quote',
            entity_id: quote.id,
            requested_by: user.sub,
            assigned_to: assignedTo,
          }, trx);

          await notificationService.createNotification({
            user_id: assignedTo,
            type: 'quote_approval',
            title: `Quote ${quote.quote_number} requires approval: $${quote.total_amount}`,
            body: `${quote.customer_name} - Discount approval needed (${approvalLevel} level)`,
            entity_type: 'quote',
            entity_id: quote.id,
            action_url: `/quotes/${quote.id}`,
          });
        }

        return {
          id: quote.id,
          quote_number: quote.quote_number,
          status: 'pending_approval',
          auto_approved: false,
          approval_level: approvalLevel,
          updated_at: updated.updated_at,
        };
      }
    });
  }

  // ─── Approve Quote ────────────────────────────────────────────────
  async approveQuote(quoteId: string, user: JwtPayload, scope: OrgScope, comments?: string) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    this.validateTransition(quote.status, 'approved');

    // Check approval authority
    const approvalLevel = await this.getHighestApprovalLevel(quoteId, quote.organization_id);
    if (approvalLevel === 'admin' && user.role !== 'admin') {
      throw AppError.forbidden(
        'This quote requires admin-level approval.',
        'AUTH_INSUFFICIENT_ROLE',
      );
    }

    return quoteRepository.transaction(async (trx) => {
      const updated = await quoteRepository.updateStatus(quote.id, quote.status, 'approved', {
        approved_by: user.sub,
        approved_at: new Date(),
        rejection_reason: null,
        requires_approval: false,
      }, trx);

      if (!updated) {
        throw new AppError(
          'Quote was modified by another user. Please refresh and try again.',
          409,
          'QUOTE_CONCURRENT_MODIFICATION',
        );
      }

      // Approve all line items
      await quoteRepository.approveAllLines(quoteId, user.sub, trx);

      await quoteRepository.insertStatusHistory({
        quote_id: quote.id,
        from_status: quote.status,
        to_status: 'approved',
        changed_by: user.sub,
        notes: comments || 'Quote approved',
      }, trx);

      // Update approval request
      await quoteRepository.updateApprovalRequest('quote', quote.id, 'approve', comments, trx);

      // Notify creator
      const approverName = `${user.email}`; // Email as fallback name
      await notificationService.createNotification({
        user_id: quote.created_by,
        type: 'quote_approval',
        title: `Quote ${quote.quote_number} approved by ${approverName}`,
        body: `Your quote for ${quote.customer_name} ($${quote.total_amount}) has been approved.${comments ? ` Comments: ${comments}` : ''}`,
        entity_type: 'quote',
        entity_id: quote.id,
        action_url: `/quotes/${quote.id}`,
      });

      return {
        id: quote.id,
        quote_number: quote.quote_number,
        status: 'approved',
        approved_by: user.sub,
        approved_at: updated.approved_at,
        updated_at: updated.updated_at,
      };
    });
  }

  // ─── Reject Quote ─────────────────────────────────────────────────
  async rejectQuote(quoteId: string, user: JwtPayload, scope: OrgScope, rejectionReason: string) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    this.validateTransition(quote.status, 'rejected');

    return quoteRepository.transaction(async (trx) => {
      const updated = await quoteRepository.updateStatus(quote.id, quote.status, 'rejected', {
        rejection_reason: rejectionReason,
      }, trx);

      if (!updated) {
        throw new AppError(
          'Quote was modified by another user. Please refresh and try again.',
          409,
          'QUOTE_CONCURRENT_MODIFICATION',
        );
      }

      await quoteRepository.insertStatusHistory({
        quote_id: quote.id,
        from_status: quote.status,
        to_status: 'rejected',
        changed_by: user.sub,
        notes: rejectionReason,
      }, trx);

      // Update approval request
      await quoteRepository.updateApprovalRequest('quote', quote.id, 'reject', rejectionReason, trx);

      // Notify creator
      const reasonPreview = rejectionReason.length > 100
        ? rejectionReason.substring(0, 100) + '...'
        : rejectionReason;

      await notificationService.createNotification({
        user_id: quote.created_by,
        type: 'quote_approval',
        title: `Quote ${quote.quote_number} rejected: ${reasonPreview}`,
        body: `Your quote for ${quote.customer_name} has been rejected. Reason: ${rejectionReason}`,
        entity_type: 'quote',
        entity_id: quote.id,
        action_url: `/quotes/${quote.id}`,
      });

      return {
        id: quote.id,
        quote_number: quote.quote_number,
        status: 'rejected',
        rejection_reason: rejectionReason,
        updated_at: updated.updated_at,
      };
    });
  }

  // ─── Send Quote to Customer ──────────────────────────────────────
  async sendQuote(quoteId: string, user: JwtPayload, scope: OrgScope) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    this.validateTransition(quote.status, 'sent_to_customer');

    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only send quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // TODO: Phase 3D — PDF generation via Puppeteer goes here
    // For now, mark the status transition without PDF generation

    const updated = await quoteRepository.updateStatus(quote.id, quote.status, 'sent_to_customer');

    if (!updated) {
      throw new AppError(
        'Quote was modified by another user. Please refresh and try again.',
        409,
        'QUOTE_CONCURRENT_MODIFICATION',
      );
    }

    await quoteRepository.insertStatusHistory({
      quote_id: quote.id,
      from_status: quote.status,
      to_status: 'sent_to_customer',
      changed_by: user.sub,
      notes: 'Quote sent to customer',
    });

    return {
      id: quote.id,
      quote_number: quote.quote_number,
      status: 'sent_to_customer',
      pdf_url: updated.pdf_url,
      updated_at: updated.updated_at,
    };
  }

  // ─── Accept Quote ─────────────────────────────────────────────────
  async acceptQuote(quoteId: string, user: JwtPayload, scope: OrgScope) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    this.validateTransition(quote.status, 'accepted');

    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only accept quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    const updated = await quoteRepository.updateStatus(quote.id, quote.status, 'accepted');

    if (!updated) {
      throw new AppError(
        'Quote was modified by another user. Please refresh and try again.',
        409,
        'QUOTE_CONCURRENT_MODIFICATION',
      );
    }

    await quoteRepository.insertStatusHistory({
      quote_id: quote.id,
      from_status: quote.status,
      to_status: 'accepted',
      changed_by: user.sub,
      notes: 'Quote accepted by customer',
    });

    return {
      id: quote.id,
      quote_number: quote.quote_number,
      status: 'accepted',
      updated_at: updated.updated_at,
    };
  }

  // ─── Clone Quote ──────────────────────────────────────────────────
  async cloneQuote(quoteId: string, user: JwtPayload, scope: OrgScope) {
    if (!user.org_id) {
      throw AppError.forbidden('User is not associated with an organization', 'AUTH_ORG_MISMATCH');
    }

    const original = await quoteRepository.findById(quoteId, scope);
    if (!original) {
      throw AppError.notFound('Quote not found');
    }

    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);

    const org = await quoteRepository.findOrganization(user.org_id);
    const tierId = org.tier_id;

    return quoteRepository.transaction(async (trx) => {
      // Create new quote header
      const newQuoteData: Record<string, any> = {
        organization_id: user.org_id,
        created_by: user.sub,
        deal_id: original.deal_id || null,
        customer_name: original.customer_name,
        customer_email: original.customer_email,
        status: 'draft',
        valid_from: now.toISOString().slice(0, 10),
        valid_until: validUntil.toISOString().slice(0, 10),
        payment_terms: original.payment_terms,
        notes: original.notes,
        terms_and_conditions: original.terms_and_conditions,
        tax_amount: 0,
        subtotal: 0,
        total_discount: 0,
        total_amount: 0,
        requires_approval: false,
      };

      const newQuote = await quoteRepository.create(newQuoteData, trx);

      // Deep copy line items with fresh pricing
      const warnings: string[] = [];
      const originalLines = original.line_items || [];

      for (const line of originalLines) {
        const product = await quoteRepository.findProduct(line.product_id);

        // Skip inactive products
        if (!product || !product.is_active || !product.available_to_partners) {
          warnings.push(
            `Line item for product '${line.product_name}' (${line.product_sku}) was skipped because the product is no longer active.`,
          );
          continue;
        }

        // Re-snapshot list_price and re-run pricing waterfall
        const pricing = await this.calculateLinePrice(
          line.product_id,
          tierId,
          line.discount_type,
          parseFloat(line.discount_value),
          line.quantity,
        );

        const discountEval = await this.evaluateDiscount(
          pricing.list_price,
          pricing.unit_price,
          tierId,
          line.product_id,
        );

        await quoteRepository.addLine({
          quote_id: newQuote.id,
          product_id: line.product_id,
          sort_order: line.sort_order,
          quantity: line.quantity,
          list_price: pricing.list_price,
          discount_type: line.discount_type,
          discount_value: parseFloat(line.discount_value),
          unit_price: pricing.unit_price,
          discount_approved: discountEval.approved,
          notes: line.notes,
        }, trx);
      }

      // Recalculate totals
      await this.updateQuoteTotals(newQuote.id, trx);

      // Update requires_approval
      const hasUnapproved = await quoteRepository.hasUnapprovedLines(newQuote.id, trx);
      await quoteRepository.updateFields(newQuote.id, { requires_approval: hasUnapproved }, trx);

      // Insert status history
      await quoteRepository.insertStatusHistory({
        quote_id: newQuote.id,
        from_status: null,
        to_status: 'draft',
        changed_by: user.sub,
        notes: `Cloned from quote ${original.quote_number}`,
      }, trx);

      // Fetch the fully-formed new quote
      const result = await quoteRepository.findRawById(newQuote.id, trx);
      const lineItems = await quoteRepository.getLines(newQuote.id, trx);

      return {
        data: { ...result, line_items: lineItems },
        warnings,
      };
    });
  }

  // ─── Recalculate All Pricing ─────────────────────────────────────
  async recalculateQuote(quoteId: string, user: JwtPayload, scope: OrgScope) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }

    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      throw new AppError(
        `Cannot recalculate a quote in '${quote.status}' status.`,
        422,
        'QUOTE_INVALID_TRANSITION',
      );
    }

    if (user.role === 'partner_rep' && quote.created_by !== user.sub) {
      throw AppError.forbidden('You can only recalculate quotes you created', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Get current org tier (may have changed since quote creation)
    const org = await quoteRepository.findOrganization(quote.organization_id);
    const tierId = org.tier_id;

    return quoteRepository.transaction(async (trx) => {
      const lines = await quoteRepository.getLines(quoteId, trx);

      for (const line of lines) {
        // Re-fetch current list_price from products
        const product = await quoteRepository.findProduct(line.product_id);
        if (!product) continue;

        const pricing = await this.calculateLinePrice(
          line.product_id,
          tierId,
          line.discount_type,
          parseFloat(line.discount_value),
          line.quantity,
        );

        const discountEval = await this.evaluateDiscount(
          pricing.list_price,
          pricing.unit_price,
          tierId,
          line.product_id,
        );

        await quoteRepository.updateLine(line.id, {
          list_price: pricing.list_price,
          unit_price: pricing.unit_price,
          discount_approved: discountEval.approved,
        }, trx);
      }

      // Recalculate totals
      await this.updateQuoteTotals(quoteId, trx);

      // Update requires_approval
      const hasUnapproved = await quoteRepository.hasUnapprovedLines(quoteId, trx);
      await quoteRepository.updateFields(quoteId, { requires_approval: hasUnapproved }, trx);

      // Return fresh quote
      const updatedQuote = await quoteRepository.findRawById(quoteId, trx);
      const updatedLines = await quoteRepository.getLines(quoteId, trx);

      return { ...updatedQuote, line_items: updatedLines };
    });
  }

  // ─── Get Status History ──────────────────────────────────────────
  async getHistory(quoteId: string, scope: OrgScope) {
    const quote = await quoteRepository.findById(quoteId, scope);
    if (!quote) {
      throw AppError.notFound('Quote not found');
    }
    return quoteRepository.getStatusHistory(quoteId);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRICING WATERFALL ENGINE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate unit_price via the pricing waterfall.
   * Fetches current list_price from products table (fresh snapshot).
   */
  async calculateLinePrice(
    productId: string,
    tierId: string | null,
    discountType: string,
    discountValue: number,
    quantity: number,
  ): Promise<PricingResult> {
    // Step 1: Get list price
    const product = await quoteRepository.findProduct(productId);
    if (!product) {
      throw AppError.notFound('Product not found');
    }
    const listPrice = parseFloat(product.list_price);

    return this.calculateLinePriceFromSnapshot(
      productId,
      listPrice,
      tierId,
      discountType,
      discountValue,
      quantity,
    );
  }

  /**
   * Calculate unit_price using a given list_price (from snapshot).
   * Used when updating existing lines where list_price should not change.
   */
  async calculateLinePriceFromSnapshot(
    productId: string,
    listPrice: number,
    tierId: string | null,
    discountType: string,
    discountValue: number,
    quantity: number,
  ): Promise<PricingResult> {
    let basePrice = listPrice;

    // Step 2: Volume discount (placeholder - not implemented Phase 3)
    const volumeDiscountPct = 0;

    // Step 3: Tier discount
    let tierDiscountApplied = 0;
    let tierDiscountedPrice = basePrice;

    if (tierId) {
      const tierPricing = await quoteRepository.findTierProductPricing(tierId, productId);

      if (tierPricing && tierPricing.special_price != null) {
        // Special price overrides everything
        tierDiscountedPrice = parseFloat(tierPricing.special_price);
        tierDiscountApplied = ((basePrice - tierDiscountedPrice) / basePrice) * 100;
      } else if (tierPricing && tierPricing.discount_pct != null) {
        tierDiscountApplied = parseFloat(tierPricing.discount_pct);
        tierDiscountedPrice = basePrice * (1 - tierDiscountApplied / 100);
      } else {
        // Fallback to tier default
        const tier = await quoteRepository.findTier(tierId);
        if (tier && tier.default_discount_pct != null) {
          tierDiscountApplied = parseFloat(tier.default_discount_pct);
          tierDiscountedPrice = basePrice * (1 - tierDiscountApplied / 100);
        }
      }
    }

    // Step 4: Apply partner-entered discount on top of tier price
    let partnerDiscountAmount = 0;
    if (discountType === 'percentage') {
      partnerDiscountAmount = tierDiscountedPrice * (discountValue / 100);
    } else {
      // fixed_amount: discount_value is dollar amount per unit
      partnerDiscountAmount = discountValue;
    }

    const unitPrice = tierDiscountedPrice - partnerDiscountAmount;

    // Guard: unit_price cannot be negative
    if (unitPrice < 0) {
      if (discountType === 'fixed_amount') {
        throw new AppError(
          `Discount results in negative unit price. Maximum fixed discount for this product is $${tierDiscountedPrice.toFixed(2)}`,
          422,
          'QUOTE_INVALID_DISCOUNT',
        );
      } else {
        throw new AppError(
          'Discount results in negative unit price',
          422,
          'QUOTE_INVALID_DISCOUNT',
        );
      }
    }

    return {
      list_price: listPrice,
      volume_discount_pct: volumeDiscountPct,
      tier_discount_pct: tierDiscountApplied,
      tier_discounted_price: tierDiscountedPrice,
      partner_discount_type: discountType,
      partner_discount_value: discountValue,
      partner_discount_amount: partnerDiscountAmount,
      unit_price: Math.round(unitPrice * 100) / 100, // Round to 2 decimal places
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // DISCOUNT EVALUATION (3-band logic)
  // ═══════════════════════════════════════════════════════════════════

  async evaluateDiscount(
    listPrice: number,
    unitPrice: number,
    tierId: string | null,
    productId: string,
  ): Promise<DiscountEvaluation> {
    // Calculate effective discount as percentage of list price
    const effectiveDiscountPct = listPrice > 0
      ? ((listPrice - unitPrice) / listPrice) * 100
      : 0;

    // Determine self-approve ceiling
    let selfApproveCeiling = 0;

    if (tierId) {
      const tierPricing = await quoteRepository.findTierProductPricing(tierId, productId);

      if (tierPricing && tierPricing.discount_pct != null) {
        selfApproveCeiling = parseFloat(tierPricing.discount_pct);
      } else {
        const tier = await quoteRepository.findTier(tierId);
        if (tier && tier.max_discount_pct != null) {
          selfApproveCeiling = parseFloat(tier.max_discount_pct);
        }
      }
    }

    // Band 1: Auto-approve
    if (effectiveDiscountPct <= selfApproveCeiling) {
      return {
        approved: true,
        level: 'auto',
        ceiling: selfApproveCeiling,
        effective_discount_pct: Math.round(effectiveDiscountPct * 100) / 100,
      };
    }

    // Band 2: Channel Manager approval
    const cmCeiling = selfApproveCeiling + DISCOUNT_CM_BUFFER_PCT;
    if (effectiveDiscountPct <= cmCeiling) {
      return {
        approved: false,
        level: 'channel_manager',
        ceiling: cmCeiling,
        effective_discount_pct: Math.round(effectiveDiscountPct * 100) / 100,
      };
    }

    // Band 3: Admin/VP approval
    return {
      approved: false,
      level: 'admin',
      ceiling: null,
      effective_discount_pct: Math.round(effectiveDiscountPct * 100) / 100,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Recalculate quote header totals from line items.
   */
  private async updateQuoteTotals(quoteId: string, trx?: Knex.Transaction) {
    const { subtotal, totalAfterDiscounts } = await quoteRepository.getLineTotals(quoteId, trx);
    const totalDiscount = subtotal - totalAfterDiscounts;

    // Get current tax_amount
    const conn = trx || db;
    const quote = await conn('quotes').where('id', quoteId).select('tax_amount').first();
    const taxAmount = quote ? parseFloat(quote.tax_amount || 0) : 0;
    const totalAmount = totalAfterDiscounts + taxAmount;

    await quoteRepository.updateFields(quoteId, {
      subtotal,
      total_discount: totalDiscount,
      total_amount: totalAmount,
    }, trx);
  }

  private validateTransition(fromStatus: string, toStatus: string): void {
    const valid = VALID_QUOTE_TRANSITIONS[fromStatus] || [];
    if (!valid.includes(toStatus)) {
      throw new AppError(
        `Cannot transition from '${fromStatus}' to '${toStatus}'`,
        422,
        'QUOTE_INVALID_TRANSITION',
      );
    }
  }

  /**
   * Determine the highest approval level needed across all unapproved line items.
   */
  private async getHighestApprovalLevel(
    quoteId: string,
    orgId: string,
  ): Promise<'channel_manager' | 'admin'> {
    const org = await quoteRepository.findOrganization(orgId);
    const tierId = org.tier_id;

    const lines = await quoteRepository.getLines(quoteId);
    let highestLevel: 'channel_manager' | 'admin' = 'channel_manager';

    for (const line of lines) {
      if (line.discount_approved) continue;

      const evaluation = await this.evaluateDiscount(
        parseFloat(line.list_price),
        parseFloat(line.unit_price),
        tierId,
        line.product_id,
      );

      if (evaluation.level === 'admin') {
        highestLevel = 'admin';
        break; // No need to check further
      }
    }

    return highestLevel;
  }

  /**
   * Find the appropriate approver based on level.
   */
  private async findApprover(orgId: string, level: string): Promise<string | null> {
    if (level === 'admin') {
      // Find any admin user
      const admin = await db('users')
        .select('id')
        .where('role', 'admin')
        .where('is_active', true)
        .first();
      return admin?.id || null;
    }

    // Channel manager: try org's assigned CM first
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

export default new QuoteService();
