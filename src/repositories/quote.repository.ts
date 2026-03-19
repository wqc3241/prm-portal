import db from '../config/database';
import { Knex } from 'knex';
import { OrgScope } from '../types/express';
import { applyOrgScope } from '../middleware/scopeToOrg';
import { v4 as uuidv4 } from 'uuid';

export interface QuoteFilters {
  status?: string;
  deal_id?: string;
  customer_name?: string;
  min_amount?: number;
  max_amount?: number;
  created_after?: string;
  created_before?: string;
  created_by?: string;
}

export class QuoteRepository {
  // ─── Create ──────────────────────────────────────────────────────────
  async create(data: Record<string, any>, trx?: Knex.Transaction) {
    const conn = trx || db;
    const id = uuidv4();
    const [quote] = await conn('quotes')
      .insert({ id, ...data })
      .returning('*');
    return quote;
  }

  // ─── Find by ID (with joins, line items) ─────────────────────────────
  async findById(id: string, scope: OrgScope) {
    let query = db('quotes as q')
      .leftJoin('organizations as o', 'q.organization_id', 'o.id')
      .leftJoin('users as u_creator', 'q.created_by', 'u_creator.id')
      .leftJoin('users as u_approver', 'q.approved_by', 'u_approver.id')
      .leftJoin('deals as d', 'q.deal_id', 'd.id')
      .select(
        'q.*',
        'o.name as organization_name',
        'o.tier_id',
        db.raw("CONCAT(u_creator.first_name, ' ', u_creator.last_name) as created_by_name"),
        db.raw("CONCAT(u_approver.first_name, ' ', u_approver.last_name) as approved_by_name"),
        'd.deal_number',
      )
      .where('q.id', id);

    query = applyOrgScope(query, scope, 'q.organization_id');
    const quote = await query.first();

    if (!quote) return null;

    // Fetch line items with product info
    const lineItems = await this.getLines(id);
    quote.line_items = lineItems;

    return quote;
  }

  // ─── Find raw (no joins, for internal use) ────────────────────────────
  async findRawById(id: string, trx?: Knex.Transaction) {
    const conn = trx || db;
    return conn('quotes').where('id', id).first();
  }

  // ─── List (paginated, filtered, scoped) ────────────────────────────────
  async list(
    scope: OrgScope,
    filters: QuoteFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('quotes as q')
      .leftJoin('organizations as o', 'q.organization_id', 'o.id')
      .leftJoin('users as u_creator', 'q.created_by', 'u_creator.id')
      .leftJoin('deals as d', 'q.deal_id', 'd.id')
      .select(
        'q.id',
        'q.quote_number',
        'q.deal_id',
        'd.deal_number',
        'q.organization_id',
        'o.name as organization_name',
        'q.created_by',
        db.raw("CONCAT(u_creator.first_name, ' ', u_creator.last_name) as created_by_name"),
        'q.customer_name',
        'q.customer_email',
        'q.subtotal',
        'q.total_discount',
        'q.total_amount',
        'q.currency',
        'q.status',
        'q.requires_approval',
        'q.valid_from',
        'q.valid_until',
        'q.created_at',
        'q.updated_at',
      );

    // Subquery for line item count
    query = query.select(
      db.raw('(SELECT COUNT(*)::int FROM quote_line_items WHERE quote_id = q.id) as line_item_count'),
    );

    let countQuery = db('quotes as q').count('* as total');

    // Apply org scoping
    query = applyOrgScope(query, scope, 'q.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'q.organization_id');

    // Apply filters
    const applyFilters = (q: any) => {
      if (filters.status) {
        const statuses = filters.status.split(',');
        q = q.whereIn('q.status', statuses);
      }
      if (filters.deal_id) {
        q = q.where('q.deal_id', filters.deal_id);
      }
      if (filters.customer_name) {
        q = q.where('q.customer_name', 'ilike', `%${filters.customer_name}%`);
      }
      if (filters.min_amount != null) {
        q = q.where('q.total_amount', '>=', filters.min_amount);
      }
      if (filters.max_amount != null) {
        q = q.where('q.total_amount', '<=', filters.max_amount);
      }
      if (filters.created_after) {
        q = q.where('q.created_at', '>=', filters.created_after);
      }
      if (filters.created_before) {
        q = q.where('q.created_at', '<=', filters.created_before);
      }
      if (filters.created_by) {
        q = q.where('q.created_by', filters.created_by);
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    // Sorting
    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = [
        'created_at', 'total_amount', 'subtotal', 'customer_name',
        'quote_number', 'status', 'valid_until', 'updated_at',
      ];
      if (allowed.includes(col)) {
        query = query.orderBy(`q.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('q.created_at', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  // ─── Update status (with optimistic concurrency) ─────────────────────
  async updateStatus(
    id: string,
    fromStatus: string,
    toStatus: string,
    extraFields: Record<string, any> = {},
    trx?: Knex.Transaction,
  ): Promise<any | null> {
    const conn = trx || db;
    const [updated] = await conn('quotes')
      .where('id', id)
      .where('status', fromStatus)
      .update({ status: toStatus, ...extraFields })
      .returning('*');
    return updated || null;
  }

  // ─── Update fields ───────────────────────────────────────────────────
  async updateFields(id: string, data: Record<string, any>, trx?: Knex.Transaction) {
    const conn = trx || db;
    const [updated] = await conn('quotes')
      .where('id', id)
      .update(data)
      .returning('*');
    return updated;
  }

  // ─── Delete quote ────────────────────────────────────────────────────
  async deleteQuote(id: string) {
    return db('quotes').where('id', id).del();
  }

  // ─── Line Items ──────────────────────────────────────────────────────

  async getLines(quoteId: string, trx?: Knex.Transaction) {
    const conn = trx || db;
    return conn('quote_line_items as li')
      .join('products as p', 'li.product_id', 'p.id')
      .select(
        'li.id',
        'li.quote_id',
        'li.product_id',
        'p.name as product_name',
        'p.sku as product_sku',
        'li.sort_order',
        'li.quantity',
        'li.list_price',
        'li.discount_type',
        'li.discount_value',
        'li.unit_price',
        'li.line_total',
        'li.discount_approved',
        'li.discount_approved_by',
        'li.notes',
        'li.created_at',
      )
      .where('li.quote_id', quoteId)
      .orderBy('li.sort_order', 'asc')
      .orderBy('li.created_at', 'asc');
  }

  async addLine(data: Record<string, any>, trx?: Knex.Transaction) {
    const conn = trx || db;
    const id = uuidv4();
    const [row] = await conn('quote_line_items')
      .insert({ id, ...data })
      .returning('*');
    return row;
  }

  async updateLine(lineId: string, data: Record<string, any>, trx?: Knex.Transaction) {
    const conn = trx || db;
    const [row] = await conn('quote_line_items')
      .where('id', lineId)
      .update(data)
      .returning('*');
    return row;
  }

  async removeLine(lineId: string, trx?: Knex.Transaction) {
    const conn = trx || db;
    return conn('quote_line_items').where('id', lineId).del();
  }

  async findLineById(lineId: string, trx?: Knex.Transaction) {
    const conn = trx || db;
    return conn('quote_line_items').where('id', lineId).first();
  }

  async getLineTotals(quoteId: string, trx?: Knex.Transaction): Promise<{
    subtotal: number;
    totalAfterDiscounts: number;
    count: number;
  }> {
    const conn = trx || db;
    const [result] = await conn('quote_line_items')
      .where('quote_id', quoteId)
      .select(
        db.raw('COALESCE(SUM(quantity * list_price), 0)::numeric as subtotal'),
        db.raw('COALESCE(SUM(line_total), 0)::numeric as total_after_discounts'),
        db.raw('COUNT(*)::int as count'),
      );
    return {
      subtotal: parseFloat(result.subtotal),
      totalAfterDiscounts: parseFloat(result.total_after_discounts),
      count: result.count,
    };
  }

  async hasUnapprovedLines(quoteId: string, trx?: Knex.Transaction): Promise<boolean> {
    const conn = trx || db;
    const [result] = await conn('quote_line_items')
      .where('quote_id', quoteId)
      .where('discount_approved', false)
      .count('* as total');
    return parseInt(result.total as string, 10) > 0;
  }

  async approveAllLines(quoteId: string, approvedBy: string, trx?: Knex.Transaction) {
    const conn = trx || db;
    return conn('quote_line_items')
      .where('quote_id', quoteId)
      .update({
        discount_approved: true,
        discount_approved_by: approvedBy,
      });
  }

  // ─── Status History ──────────────────────────────────────────────────

  async insertStatusHistory(
    data: {
      quote_id: string;
      from_status: string | null;
      to_status: string;
      changed_by: string;
      notes?: string;
    },
    trx?: Knex.Transaction,
  ) {
    const conn = trx || db;
    const id = uuidv4();
    const [row] = await conn('quote_status_history')
      .insert({ id, ...data })
      .returning('*');
    return row;
  }

  async getStatusHistory(quoteId: string) {
    return db('quote_status_history as h')
      .leftJoin('users as u', 'h.changed_by', 'u.id')
      .select(
        'h.id',
        'h.from_status',
        'h.to_status',
        'h.changed_by',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as changed_by_name"),
        'h.notes',
        'h.created_at',
      )
      .where('h.quote_id', quoteId)
      .orderBy('h.created_at', 'asc');
  }

  // ─── Approval Requests ──────────────────────────────────────────────

  async createApprovalRequest(
    data: {
      entity_type: string;
      entity_id: string;
      requested_by: string;
      assigned_to: string;
    },
    trx?: Knex.Transaction,
  ) {
    const conn = trx || db;
    const id = uuidv4();
    const [row] = await conn('approval_requests')
      .insert({ id, ...data })
      .returning('*');
    return row;
  }

  async updateApprovalRequest(
    entityType: string,
    entityId: string,
    action: string,
    comments?: string,
    trx?: Knex.Transaction,
  ) {
    const conn = trx || db;
    return conn('approval_requests')
      .where('entity_type', entityType)
      .where('entity_id', entityId)
      .whereNull('action')
      .update({
        action,
        decided_at: db.fn.now(),
        comments: comments || null,
      });
  }

  // ─── Product / Tier Lookups (read-only) ──────────────────────────────

  async findProduct(productId: string) {
    return db('products').where('id', productId).first();
  }

  async findTierProductPricing(tierId: string, productId: string) {
    return db('tier_product_pricing')
      .where('tier_id', tierId)
      .where('product_id', productId)
      .first();
  }

  async findTier(tierId: string) {
    return db('partner_tiers').where('id', tierId).first();
  }

  async findOrganization(orgId: string) {
    return db('organizations').where('id', orgId).first();
  }

  async findDeal(dealId: string, orgScope: OrgScope) {
    let query = db('deals').where('id', dealId);
    query = applyOrgScope(query, orgScope, 'organization_id');
    return query.first();
  }

  // ─── Transaction helper ──────────────────────────────────────────────
  async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return db.transaction(callback);
  }
}

export default new QuoteRepository();
