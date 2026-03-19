import db from '../config/database';
import { Knex } from 'knex';
import { OrgScope } from '../types/express';
import { applyOrgScope } from '../middleware/scopeToOrg';
import { v4 as uuidv4 } from 'uuid';

export interface AllocationFilters {
  organization_id?: string;
  fiscal_year?: number;
  fiscal_quarter?: number;
}

export interface RequestFilters {
  status?: string;
  organization_id?: string;
  allocation_id?: string;
  activity_type?: string;
  submitted_by?: string;
}

export class MdfRepository {
  // ═══════════════════════════════════════════════════════════════════════
  // ALLOCATIONS
  // ═══════════════════════════════════════════════════════════════════════

  async createAllocation(data: Record<string, any>) {
    const id = uuidv4();
    const [alloc] = await db('mdf_allocations')
      .insert({ id, ...data })
      .returning('*');
    return alloc;
  }

  async findAllocationById(id: string, scope: OrgScope) {
    let query = db('mdf_allocations as a')
      .leftJoin('organizations as o', 'a.organization_id', 'o.id')
      .select(
        'a.*',
        'o.name as organization_name',
      )
      .where('a.id', id);

    query = applyOrgScope(query, scope, 'a.organization_id');
    return query.first();
  }

  async findAllocationByOrgQuarter(
    organizationId: string,
    fiscalYear: number,
    fiscalQuarter: number,
  ) {
    return db('mdf_allocations')
      .where('organization_id', organizationId)
      .where('fiscal_year', fiscalYear)
      .where('fiscal_quarter', fiscalQuarter)
      .first();
  }

  async listAllocations(
    scope: OrgScope,
    filters: AllocationFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('mdf_allocations as a')
      .leftJoin('organizations as o', 'a.organization_id', 'o.id')
      .select(
        'a.*',
        'o.name as organization_name',
      );

    let countQuery = db('mdf_allocations as a').count('* as total');

    query = applyOrgScope(query, scope, 'a.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'a.organization_id');

    const applyFilters = (q: any) => {
      if (filters.organization_id) {
        q = q.where('a.organization_id', filters.organization_id);
      }
      if (filters.fiscal_year != null) {
        q = q.where('a.fiscal_year', filters.fiscal_year);
      }
      if (filters.fiscal_quarter != null) {
        q = q.where('a.fiscal_quarter', filters.fiscal_quarter);
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['created_at', 'fiscal_year', 'fiscal_quarter', 'allocated_amount', 'remaining_amount'];
      if (allowed.includes(col)) {
        query = query.orderBy(`a.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('a.fiscal_year', 'desc').orderBy('a.fiscal_quarter', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  async updateAllocation(id: string, data: Record<string, any>) {
    const [updated] = await db('mdf_allocations')
      .where('id', id)
      .update(data)
      .returning('*');
    return updated || null;
  }

  /**
   * Lock and update spent_amount atomically.
   * Uses SELECT ... FOR UPDATE to prevent concurrent over-commitment.
   */
  async adjustSpentAmount(
    allocationId: string,
    delta: number,
    trx: Knex.Transaction,
  ) {
    // Lock the allocation row
    const alloc = await trx('mdf_allocations')
      .where('id', allocationId)
      .forUpdate()
      .first();

    if (!alloc) return null;

    const newSpent = parseFloat(alloc.spent_amount) + delta;
    if (newSpent < 0) return null; // cannot go negative

    const [updated] = await trx('mdf_allocations')
      .where('id', allocationId)
      .update({ spent_amount: newSpent })
      .returning('*');

    return updated;
  }

  /**
   * Lock allocation for read during submit/approve to get accurate remaining.
   */
  async findAllocationForUpdate(allocationId: string, trx: Knex.Transaction) {
    return trx('mdf_allocations')
      .where('id', allocationId)
      .forUpdate()
      .first();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

  async createRequest(data: Record<string, any>) {
    const id = uuidv4();
    const [req] = await db('mdf_requests')
      .insert({ id, ...data })
      .returning('*');
    return req;
  }

  async findRequestById(id: string, scope: OrgScope) {
    let query = db('mdf_requests as r')
      .leftJoin('mdf_allocations as a', 'r.allocation_id', 'a.id')
      .leftJoin('organizations as o', 'r.organization_id', 'o.id')
      .leftJoin('users as u_sub', 'r.submitted_by', 'u_sub.id')
      .leftJoin('users as u_rev', 'r.reviewed_by', 'u_rev.id')
      .select(
        'r.*',
        'o.name as organization_name',
        db.raw("CONCAT(u_sub.first_name, ' ', u_sub.last_name) as submitted_by_name"),
        db.raw("CONCAT(u_rev.first_name, ' ', u_rev.last_name) as reviewed_by_name"),
        'a.allocated_amount as allocation_allocated_amount',
        'a.spent_amount as allocation_spent_amount',
        'a.remaining_amount as allocation_remaining_amount',
        'a.fiscal_year as allocation_fiscal_year',
        'a.fiscal_quarter as allocation_fiscal_quarter',
      )
      .where('r.id', id);

    query = applyOrgScope(query, scope, 'r.organization_id');
    return query.first();
  }

  async findRequestRawById(id: string) {
    return db('mdf_requests').where('id', id).first();
  }

  async listRequests(
    scope: OrgScope,
    filters: RequestFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('mdf_requests as r')
      .leftJoin('mdf_allocations as a', 'r.allocation_id', 'a.id')
      .leftJoin('organizations as o', 'r.organization_id', 'o.id')
      .leftJoin('users as u_sub', 'r.submitted_by', 'u_sub.id')
      .select(
        'r.id',
        'r.request_number',
        'r.allocation_id',
        'r.organization_id',
        'o.name as organization_name',
        'r.submitted_by',
        db.raw("CONCAT(u_sub.first_name, ' ', u_sub.last_name) as submitted_by_name"),
        'r.activity_type',
        'r.activity_name',
        'r.start_date',
        'r.end_date',
        'r.requested_amount',
        'r.approved_amount',
        'r.status',
        'r.claim_amount',
        'r.reimbursement_amount',
        'r.created_at',
      );

    let countQuery = db('mdf_requests as r').count('* as total');

    query = applyOrgScope(query, scope, 'r.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'r.organization_id');

    const applyFilters = (q: any) => {
      if (filters.status) {
        const statuses = filters.status.split(',');
        q = q.whereIn('r.status', statuses);
      }
      if (filters.organization_id) {
        q = q.where('r.organization_id', filters.organization_id);
      }
      if (filters.allocation_id) {
        q = q.where('r.allocation_id', filters.allocation_id);
      }
      if (filters.activity_type) {
        q = q.where('r.activity_type', filters.activity_type);
      }
      if (filters.submitted_by) {
        q = q.where('r.submitted_by', filters.submitted_by);
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = [
        'created_at', 'requested_amount', 'approved_amount', 'start_date',
        'end_date', 'status', 'request_number', 'activity_name',
      ];
      if (allowed.includes(col)) {
        query = query.orderBy(`r.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('r.created_at', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  /**
   * Update request status with optimistic concurrency (WHERE status = fromStatus).
   */
  async updateRequestStatus(
    id: string,
    fromStatus: string,
    toStatus: string,
    extraFields: Record<string, any> = {},
  ): Promise<any | null> {
    const [updated] = await db('mdf_requests')
      .where('id', id)
      .where('status', fromStatus)
      .update({ status: toStatus, ...extraFields })
      .returning('*');
    return updated || null;
  }

  /**
   * Update request status within a transaction.
   */
  async updateRequestStatusTrx(
    id: string,
    fromStatus: string,
    toStatus: string,
    extraFields: Record<string, any>,
    trx: Knex.Transaction,
  ): Promise<any | null> {
    const [updated] = await trx('mdf_requests')
      .where('id', id)
      .where('status', fromStatus)
      .update({ status: toStatus, ...extraFields })
      .returning('*');
    return updated || null;
  }

  async updateRequestFields(id: string, data: Record<string, any>) {
    const [updated] = await db('mdf_requests')
      .where('id', id)
      .update(data)
      .returning('*');
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AGGREGATES & HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Sum of approved amounts for an allocation (requests in approved+ statuses).
   */
  async getRequestTotals(allocationId: string) {
    const [result] = await db('mdf_requests')
      .where('allocation_id', allocationId)
      .whereIn('status', ['approved', 'completed', 'claim_submitted', 'claim_approved', 'reimbursed'])
      .select(
        db.raw('COALESCE(SUM(approved_amount), 0)::numeric as total_approved'),
        db.raw('COALESCE(SUM(claim_amount), 0)::numeric as total_claimed'),
        db.raw('COUNT(*)::int as count'),
      );
    return {
      total_approved: parseFloat(result.total_approved),
      total_claimed: parseFloat(result.total_claimed),
      count: result.count,
    };
  }

  /**
   * Get trailing 4-quarter revenue for an org (sum of won deal actual_value).
   */
  async getTrailingRevenue(orgId: string, fiscalQuarterStart: Date): Promise<number> {
    const lookbackStart = new Date(fiscalQuarterStart);
    lookbackStart.setMonth(lookbackStart.getMonth() - 12);

    const [result] = await db('deals')
      .where('organization_id', orgId)
      .where('status', 'won')
      .whereNotNull('actual_close_date')
      .where('actual_close_date', '>=', lookbackStart.toISOString().slice(0, 10))
      .where('actual_close_date', '<', fiscalQuarterStart.toISOString().slice(0, 10))
      .select(db.raw('COALESCE(SUM(actual_value), 0)::numeric as total'));

    return parseFloat(result.total);
  }

  /**
   * Get the revenue threshold for top 10% within a tier.
   * Returns the revenue value at the 90th percentile for that tier.
   */
  async getTopPerformerThreshold(
    tierId: string,
    fiscalQuarterStart: Date,
  ): Promise<number> {
    const lookbackStart = new Date(fiscalQuarterStart);
    lookbackStart.setMonth(lookbackStart.getMonth() - 12);

    // Get all orgs in this tier and their trailing revenue
    const orgs = await db('organizations as o')
      .where('o.tier_id', tierId)
      .where('o.status', 'active')
      .select(
        'o.id',
        db.raw(`
          COALESCE((
            SELECT SUM(d.actual_value)
            FROM deals d
            WHERE d.organization_id = o.id
              AND d.status = 'won'
              AND d.actual_close_date >= ?
              AND d.actual_close_date < ?
          ), 0)::numeric as trailing_revenue
        `, [lookbackStart.toISOString().slice(0, 10), fiscalQuarterStart.toISOString().slice(0, 10)]),
      );

    if (orgs.length === 0) return Infinity;

    // Sort descending
    const revenues = orgs
      .map((o: any) => parseFloat(o.trailing_revenue))
      .sort((a: number, b: number) => b - a);

    // Top 10% threshold: org must be in the top ceil(10% * count) positions
    const top10Index = Math.ceil(revenues.length * 0.10);
    if (top10Index <= 0) return Infinity;

    // The threshold is the revenue at the boundary position
    return revenues[top10Index - 1] || Infinity;
  }

  /**
   * Get all active orgs with their tier info for auto-allocation.
   */
  async getActiveOrgsWithTier() {
    return db('organizations as o')
      .join('partner_tiers as t', 'o.tier_id', 't.id')
      .where('o.status', 'active')
      .select(
        'o.id as org_id',
        'o.name as org_name',
        'o.tier_id',
        't.name as tier_name',
        't.mdf_budget_pct',
      );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // APPROVAL REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════
  // BACKGROUND JOB QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find requests with approaching claim deadlines.
   * Returns approved/completed requests where end_date + 60 days is approaching.
   */
  async findRequestsForClaimDeadline() {
    return db('mdf_requests')
      .select('id', 'request_number', 'submitted_by', 'organization_id', 'end_date', 'status')
      .whereIn('status', ['approved', 'completed'])
      .whereNotNull('end_date');
  }
}

export default new MdfRepository();
