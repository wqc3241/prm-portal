import db from '../config/database';
import { Knex } from 'knex';
import { OrgScope } from '../types/express';
import { applyOrgScope } from '../middleware/scopeToOrg';
import { v4 as uuidv4 } from 'uuid';

export interface DealFilters {
  status?: string;
  org_id?: string;
  submitted_by?: string;
  customer_company?: string;
  min_value?: number;
  max_value?: number;
  expected_close_before?: string;
  expected_close_after?: string;
  is_conflicting?: boolean;
  search?: string;
}

export class DealRepository {
  // ─── Create ──────────────────────────────────────────────────────────
  async create(data: Record<string, any>) {
    const id = uuidv4();
    const [deal] = await db('deals')
      .insert({ id, ...data })
      .returning('*');
    return deal;
  }

  // ─── Find by ID (with org join, optional products) ───────────────────
  async findById(id: string, scope: OrgScope) {
    let query = db('deals as d')
      .leftJoin('organizations as o', 'd.organization_id', 'o.id')
      .leftJoin('users as u_sub', 'd.submitted_by', 'u_sub.id')
      .leftJoin('users as u_cm', 'd.assigned_to', 'u_cm.id')
      .select(
        'd.*',
        'o.name as organization_name',
        db.raw("CONCAT(u_sub.first_name, ' ', u_sub.last_name) as submitted_by_name"),
        db.raw("CONCAT(u_cm.first_name, ' ', u_cm.last_name) as assigned_to_name"),
      )
      .where('d.id', id);

    query = applyOrgScope(query, scope, 'd.organization_id');
    const deal = await query.first();

    if (!deal) return null;

    // Fetch products
    const products = await this.getProducts(id);
    deal.products = products;

    return deal;
  }

  // ─── Find raw (no joins, for internal use) ──────────────────────────
  async findRawById(id: string) {
    return db('deals').where('id', id).first();
  }

  // ─── List (paginated, filtered, scoped) ──────────────────────────────
  async list(
    scope: OrgScope,
    filters: DealFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('deals as d')
      .leftJoin('organizations as o', 'd.organization_id', 'o.id')
      .leftJoin('users as u_sub', 'd.submitted_by', 'u_sub.id')
      .select(
        'd.id',
        'd.deal_number',
        'd.organization_id',
        'o.name as organization_name',
        'd.submitted_by',
        db.raw("CONCAT(u_sub.first_name, ' ', u_sub.last_name) as submitted_by_name"),
        'd.customer_company_name',
        'd.deal_name',
        'd.status',
        'd.estimated_value',
        'd.expected_close_date',
        'd.registration_expires_at',
        'd.is_conflicting',
        'd.created_at',
      );

    // Subquery for product count
    query = query.select(
      db.raw('(SELECT COUNT(*)::int FROM deal_products WHERE deal_id = d.id) as product_count'),
    );

    let countQuery = db('deals as d').count('* as total');

    // Apply org scoping
    query = applyOrgScope(query, scope, 'd.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'd.organization_id');

    // Apply filters
    const applyFilters = (q: any) => {
      if (filters.status) {
        const statuses = filters.status.split(',');
        q = q.whereIn('d.status', statuses);
      }
      if (filters.org_id) {
        q = q.where('d.organization_id', filters.org_id);
      }
      if (filters.submitted_by) {
        q = q.where('d.submitted_by', filters.submitted_by);
      }
      if (filters.customer_company) {
        q = q.where('d.customer_company_name', 'ilike', `%${filters.customer_company}%`);
      }
      if (filters.min_value != null) {
        q = q.where('d.estimated_value', '>=', filters.min_value);
      }
      if (filters.max_value != null) {
        q = q.where('d.estimated_value', '<=', filters.max_value);
      }
      if (filters.expected_close_before) {
        q = q.where('d.expected_close_date', '<=', filters.expected_close_before);
      }
      if (filters.expected_close_after) {
        q = q.where('d.expected_close_date', '>=', filters.expected_close_after);
      }
      if (filters.is_conflicting != null) {
        q = q.where('d.is_conflicting', filters.is_conflicting);
      }
      if (filters.search) {
        const term = `%${filters.search}%`;
        q = q.where(function (this: Knex.QueryBuilder) {
          this.where('d.deal_number', 'ilike', term)
            .orWhere('d.deal_name', 'ilike', term)
            .orWhere('d.customer_company_name', 'ilike', term);
        });
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    // Sorting
    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = [
        'created_at', 'estimated_value', 'expected_close_date',
        'customer_company_name', 'deal_name', 'status', 'deal_number',
      ];
      if (allowed.includes(col)) {
        query = query.orderBy(`d.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('d.created_at', 'desc');
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
  ): Promise<any | null> {
    const [updated] = await db('deals')
      .where('id', id)
      .where('status', fromStatus)
      .update({ status: toStatus, ...extraFields })
      .returning('*');
    return updated || null;
  }

  // ─── Update fields ───────────────────────────────────────────────────
  async updateFields(id: string, data: Record<string, any>) {
    const [updated] = await db('deals')
      .where('id', id)
      .update(data)
      .returning('*');
    return updated;
  }

  // ─── Deal Products ──────────────────────────────────────────────────
  async getProducts(dealId: string) {
    return db('deal_products as dp')
      .join('products as p', 'dp.product_id', 'p.id')
      .select(
        'dp.id',
        'dp.deal_id',
        'dp.product_id',
        'p.name as product_name',
        'p.sku as product_sku',
        'dp.quantity',
        'dp.unit_price',
        'dp.discount_pct',
        'dp.line_total',
      )
      .where('dp.deal_id', dealId);
  }

  async addProduct(data: {
    deal_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
  }) {
    const id = uuidv4();
    const [row] = await db('deal_products')
      .insert({ id, ...data })
      .returning('*');
    return row;
  }

  async removeProduct(dealId: string, productId: string): Promise<number> {
    return db('deal_products')
      .where('deal_id', dealId)
      .where('product_id', productId)
      .del();
  }

  async findDealProduct(dealId: string, productId: string) {
    return db('deal_products')
      .where('deal_id', dealId)
      .where('product_id', productId)
      .first();
  }

  async getProductLineTotal(dealId: string): Promise<{ sum: number; count: number }> {
    const [result] = await db('deal_products')
      .where('deal_id', dealId)
      .select(
        db.raw('COALESCE(SUM(line_total), 0)::numeric as sum'),
        db.raw('COUNT(*)::int as count'),
      );
    return { sum: parseFloat((result as any).sum), count: (result as any).count };
  }

  // ─── Status History ─────────────────────────────────────────────────
  async insertStatusHistory(data: {
    deal_id: string;
    from_status: string | null;
    to_status: string;
    changed_by: string;
    notes?: string;
  }) {
    const id = uuidv4();
    const [row] = await db('deal_status_history')
      .insert({ id, ...data })
      .returning('*');
    return row;
  }

  async getStatusHistory(dealId: string) {
    return db('deal_status_history as h')
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
      .where('h.deal_id', dealId)
      .orderBy('h.created_at', 'asc');
  }

  // ─── Conflict Detection ─────────────────────────────────────────────
  async findConflicts(
    customerCompany: string,
    customerEmail: string | null,
    productId: string | null,
    excludeDealId: string | null = null,
  ) {
    const result = await db.raw(
      'SELECT * FROM find_deal_conflicts(?, ?, ?::uuid, ?::uuid)',
      [customerCompany, customerEmail || null, productId || null, excludeDealId || null],
    );
    return result.rows;
  }

  // ─── Expiring Deals ─────────────────────────────────────────────────
  async findExpiring(
    days: number,
    scope: OrgScope,
    pagination: { offset: number; limit: number },
  ) {
    let query = db('deals as d')
      .leftJoin('organizations as o', 'd.organization_id', 'o.id')
      .leftJoin('users as u_sub', 'd.submitted_by', 'u_sub.id')
      .select(
        'd.*',
        'o.name as organization_name',
        db.raw("CONCAT(u_sub.first_name, ' ', u_sub.last_name) as submitted_by_name"),
      )
      .where('d.status', 'approved')
      .whereNotNull('d.registration_expires_at')
      .whereRaw('d.registration_expires_at <= NOW() + ?::interval', [`${days} days`])
      .where('d.registration_expires_at', '>', db.fn.now());

    let countQuery = db('deals as d')
      .count('* as total')
      .where('d.status', 'approved')
      .whereNotNull('d.registration_expires_at')
      .whereRaw('d.registration_expires_at <= NOW() + ?::interval', [`${days} days`])
      .where('d.registration_expires_at', '>', db.fn.now());

    query = applyOrgScope(query, scope, 'd.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'd.organization_id');

    query = query.orderBy('d.registration_expires_at', 'asc')
      .offset(pagination.offset)
      .limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;
    return { data, total };
  }

  // ─── Find expired deals (for background job) ───────────────────────
  async findExpired() {
    return db('deals')
      .select('id', 'deal_number', 'submitted_by', 'organization_id')
      .where('status', 'approved')
      .whereNotNull('registration_expires_at')
      .where('registration_expires_at', '<', db.fn.now());
  }

  // ─── Find deals expiring within a window (for reminder job) ─────────
  async findExpiringInWindow(minDays: number, maxDays: number) {
    return db('deals')
      .select('id', 'deal_number', 'submitted_by', 'organization_id', 'registration_expires_at')
      .where('status', 'approved')
      .whereNotNull('registration_expires_at')
      .whereRaw('registration_expires_at BETWEEN NOW() + ?::interval AND NOW() + ?::interval', [
        `${minDays} days`,
        `${maxDays} days`,
      ]);
  }

  // ─── Approval Requests ──────────────────────────────────────────────
  async createApprovalRequest(data: {
    entity_type: string;
    entity_id: string;
    requested_by: string;
    assigned_to: string;
  }) {
    const id = uuidv4();
    const [row] = await db('approval_requests')
      .insert({ id, ...data })
      .returning('*');
    return row;
  }

  async updateApprovalRequest(
    entityType: string,
    entityId: string,
    action: string,
    comments?: string,
  ) {
    return db('approval_requests')
      .where('entity_type', entityType)
      .where('entity_id', entityId)
      .whereNull('action')
      .update({
        action,
        decided_at: db.fn.now(),
        comments: comments || null,
      });
  }
}

export default new DealRepository();
