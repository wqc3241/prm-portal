import db from '../config/database';
import { Knex } from 'knex';
import { OrgScope } from '../types/express';
import { applyOrgScope } from '../middleware/scopeToOrg';
import { v4 as uuidv4 } from 'uuid';

export interface LeadFilters {
  status?: string;
  score_min?: number;
  score_max?: number;
  source?: string;
  assigned_org_id?: string;
  assigned_user_id?: string;
  search?: string;
  created_after?: string;
  created_before?: string;
}

export class LeadRepository {
  // ─── Create ──────────────────────────────────────────────────────────
  async create(data: Record<string, any>) {
    const id = uuidv4();
    const [lead] = await db('leads')
      .insert({ id, ...data })
      .returning('*');
    return lead;
  }

  // ─── Find by ID (with org/user joins) ────────────────────────────────
  async findById(id: string, scope: OrgScope) {
    let query = db('leads as l')
      .leftJoin('organizations as o', 'l.assigned_org_id', 'o.id')
      .leftJoin('users as u_assigned', 'l.assigned_user_id', 'u_assigned.id')
      .leftJoin('deals as d', 'l.converted_deal_id', 'd.id')
      .select(
        'l.*',
        'o.name as assigned_org_name',
        db.raw("CONCAT(u_assigned.first_name, ' ', u_assigned.last_name) as assigned_user_name"),
        'd.deal_number as converted_deal_number',
      )
      .where('l.id', id);

    query = this.applyLeadScope(query, scope);
    return query.first() || null;
  }

  // ─── Find raw (no joins, for internal use) ───────────────────────────
  async findRawById(id: string) {
    return db('leads').where('id', id).first();
  }

  // ─── List (paginated, filtered, scoped) ──────────────────────────────
  async list(
    scope: OrgScope,
    filters: LeadFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('leads as l')
      .leftJoin('organizations as o', 'l.assigned_org_id', 'o.id')
      .leftJoin('users as u_assigned', 'l.assigned_user_id', 'u_assigned.id')
      .select(
        'l.id',
        'l.lead_number',
        'l.first_name',
        'l.last_name',
        'l.email',
        'l.company_name',
        'l.industry',
        'l.status',
        'l.score',
        'l.source',
        'l.assigned_org_id',
        'o.name as assigned_org_name',
        'l.assigned_user_id',
        db.raw("CONCAT(u_assigned.first_name, ' ', u_assigned.last_name) as assigned_user_name"),
        'l.assigned_at',
        'l.accepted_at',
        'l.sla_deadline',
        'l.converted_deal_id',
        'l.converted_at',
        'l.city',
        'l.state_province',
        'l.country',
        'l.tags',
        'l.created_at',
      );

    let countQuery = db('leads as l').count('* as total');

    // Apply org scoping
    query = this.applyLeadScope(query, scope);
    countQuery = this.applyLeadScope(countQuery, scope);

    // Apply filters
    const applyFilters = (q: any) => {
      if (filters.status) {
        const statuses = filters.status.split(',');
        q = q.whereIn('l.status', statuses);
      }
      if (filters.score_min != null) {
        q = q.where('l.score', '>=', filters.score_min);
      }
      if (filters.score_max != null) {
        q = q.where('l.score', '<=', filters.score_max);
      }
      if (filters.source) {
        q = q.where('l.source', filters.source);
      }
      if (filters.assigned_org_id) {
        q = q.where('l.assigned_org_id', filters.assigned_org_id);
      }
      if (filters.assigned_user_id) {
        q = q.where('l.assigned_user_id', filters.assigned_user_id);
      }
      if (filters.created_after) {
        q = q.where('l.created_at', '>=', filters.created_after);
      }
      if (filters.created_before) {
        q = q.where('l.created_at', '<=', filters.created_before);
      }
      if (filters.search) {
        const term = `%${filters.search}%`;
        q = q.where(function (this: Knex.QueryBuilder) {
          this.where('l.first_name', 'ilike', term)
            .orWhere('l.last_name', 'ilike', term)
            .orWhere('l.company_name', 'ilike', term)
            .orWhere('l.email', 'ilike', term)
            .orWhere('l.lead_number', 'ilike', term);
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
        'created_at', 'score', 'first_name', 'last_name',
        'company_name', 'status', 'lead_number', 'assigned_at', 'sla_deadline',
      ];
      if (allowed.includes(col)) {
        query = query.orderBy(`l.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('l.created_at', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  // ─── Find Unassigned (new or returned) ────────────────────────────────
  async findUnassigned(
    scope: OrgScope,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('leads as l')
      .select(
        'l.id',
        'l.lead_number',
        'l.first_name',
        'l.last_name',
        'l.email',
        'l.company_name',
        'l.industry',
        'l.status',
        'l.score',
        'l.source',
        'l.city',
        'l.state_province',
        'l.country',
        'l.return_reason',
        'l.tags',
        'l.created_at',
      )
      .whereIn('l.status', ['new', 'returned']);

    let countQuery = db('leads as l')
      .count('* as total')
      .whereIn('l.status', ['new', 'returned']);

    // Admin sees all unassigned; CM sees all unassigned (not scoped by org since unassigned have no org)
    // No org scoping needed since these leads have no assigned_org_id

    // Sorting
    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['created_at', 'score', 'company_name', 'lead_number'];
      if (allowed.includes(col)) {
        query = query.orderBy(`l.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('l.score', 'desc').orderBy('l.created_at', 'asc');
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
    const [updated] = await db('leads')
      .where('id', id)
      .where('status', fromStatus)
      .update({ status: toStatus, ...extraFields })
      .returning('*');
    return updated || null;
  }

  // ─── Update fields ───────────────────────────────────────────────────
  async updateFields(id: string, data: Record<string, any>) {
    const [updated] = await db('leads')
      .where('id', id)
      .update(data)
      .returning('*');
    return updated;
  }

  // ─── Get partner lead count (for load balancing) ─────────────────────
  async getPartnerLeadCounts(orgIds: string[]): Promise<Record<string, number>> {
    if (orgIds.length === 0) return {};

    const results = await db('leads')
      .select('assigned_org_id')
      .count('* as count')
      .whereIn('assigned_org_id', orgIds)
      .whereIn('status', ['assigned', 'accepted', 'contacted', 'qualified'])
      .groupBy('assigned_org_id');

    const counts: Record<string, number> = {};
    for (const orgId of orgIds) {
      counts[orgId] = 0;
    }
    for (const row of results) {
      counts[row.assigned_org_id] = parseInt(row.count as string, 10);
    }
    return counts;
  }

  // ─── Get return count from activity feed ─────────────────────────────
  async getReturnCount(leadId: string): Promise<number> {
    const [result] = await db('activity_feed')
      .where('entity_type', 'lead')
      .where('entity_id', leadId)
      .where('action', 'returned')
      .count('* as total');
    return parseInt(result.total as string, 10);
  }

  // ─── Insert activity feed entry ─────────────────────────────────────
  async insertActivity(data: {
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    summary: string;
    changes?: Record<string, any>;
    organization_id?: string | null;
  }) {
    const id = uuidv4();
    const [row] = await db('activity_feed')
      .insert({
        id,
        actor_id: data.actor_id,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        summary: data.summary,
        changes: data.changes ? JSON.stringify(data.changes) : null,
        organization_id: data.organization_id || null,
      })
      .returning('*');
    return row;
  }

  // ─── Get activity history for a lead ─────────────────────────────────
  async getHistory(leadId: string) {
    return db('activity_feed as a')
      .leftJoin('users as u', 'a.actor_id', 'u.id')
      .select(
        'a.id',
        'a.action',
        'a.summary',
        'a.changes',
        'a.actor_id',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as actor_name"),
        'a.created_at',
      )
      .where('a.entity_type', 'lead')
      .where('a.entity_id', leadId)
      .orderBy('a.created_at', 'asc');
  }

  // ─── Find leads approaching SLA warning ──────────────────────────────
  async findApproachingSla() {
    return db('leads')
      .select('id', 'lead_number', 'first_name', 'last_name', 'company_name',
        'assigned_org_id', 'sla_deadline')
      .where('status', 'assigned')
      .whereRaw("sla_deadline BETWEEN NOW() AND NOW() + INTERVAL '24 hours'");
  }

  // ─── Find leads past SLA deadline ────────────────────────────────────
  async findPastSla() {
    return db('leads')
      .select('id', 'lead_number', 'first_name', 'last_name', 'company_name',
        'assigned_org_id', 'sla_deadline')
      .where('status', 'assigned')
      .where('sla_deadline', '<', db.fn.now());
  }

  // ─── Eligible orgs for assignment algorithm ──────────────────────────
  async getEligibleOrgs(cmUserId: string | null, isAdmin: boolean) {
    let query = db('organizations as o')
      .join('partner_tiers as t', 'o.tier_id', 't.id')
      .select(
        'o.id',
        'o.name',
        'o.industry',
        'o.city',
        'o.state_province',
        'o.country',
        'o.tier_id',
        't.name as tier_name',
        't.rank as tier_rank',
      )
      .where('o.status', 'active')
      .whereNotNull('o.tier_id');

    // CM can only assign to their own orgs
    if (!isAdmin && cmUserId) {
      query = query.where('o.channel_manager_id', cmUserId);
    }

    // Only orgs with at least one active user
    query = query.whereExists(function () {
      this.select(db.raw(1))
        .from('users')
        .whereRaw('users.organization_id = o.id')
        .where('users.is_active', true);
    });

    return query;
  }

  // ─── Get max tier rank ───────────────────────────────────────────────
  async getMaxTierRank(): Promise<number> {
    const [result] = await db('partner_tiers')
      .max('rank as max_rank');
    return result?.max_rank || 1;
  }

  // ─── Helper: apply lead scoping ─────────────────────────────────────
  private applyLeadScope(query: any, scope: OrgScope): any {
    if (scope.type === 'all') {
      return query;
    }
    if (scope.type === 'assigned') {
      return query.whereIn('l.assigned_org_id', scope.assignedOrgIds || []);
    }
    // 'own' — partner sees only leads assigned to their org
    return query.where('l.assigned_org_id', scope.organizationId);
  }
}

export default new LeadRepository();
