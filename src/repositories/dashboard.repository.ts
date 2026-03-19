import db from '../config/database';
import { Knex } from 'knex';

// ─── Helper: apply org filter ─────────────────────────────────────────────────

function applyOrgFilter(
  query: Knex.QueryBuilder,
  orgIds: string[] | null,
  column: string = 'organization_id',
): Knex.QueryBuilder {
  if (!orgIds) return query; // null = no filter (admin)
  if (orgIds.length === 0) return query.whereRaw('1 = 0'); // CM with no orgs
  if (orgIds.length === 1) return query.where(column, orgIds[0]);
  return query.whereIn(column, orgIds);
}

// ─── Pipeline Statuses ────────────────────────────────────────────────────────

const ACTIVE_PIPELINE_STATUSES = ['submitted', 'under_review', 'approved'];
const ALL_DEAL_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'won', 'lost', 'rejected', 'expired'];

class DashboardRepository {
  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER DASHBOARD QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pipeline summary: total value & count of active deals, broken down by status.
   * userId is set for partner_rep scoping.
   */
  async getPipelineSummary(orgId: string, userId?: string) {
    let query = db('deals')
      .select('status')
      .count('* as count')
      .sum('estimated_value as value')
      .where('organization_id', orgId)
      .groupBy('status');

    if (userId) {
      query = query.where('submitted_by', userId);
    }

    const rows: Array<{ status: string; count: string; value: string | null }> = await query;

    // Build a map with all statuses initialized to 0
    const byStatus = ALL_DEAL_STATUSES.map((s) => {
      const row = rows.find((r) => r.status === s);
      return {
        status: s,
        count: row ? parseInt(row.count as string, 10) : 0,
        value: row ? parseFloat(row.value as string) || 0 : 0,
      };
    });

    const activeRows = byStatus.filter((r) => ACTIVE_PIPELINE_STATUSES.includes(r.status));
    const totalValue = activeRows.reduce((sum, r) => sum + r.value, 0);
    const dealCount = activeRows.reduce((sum, r) => sum + r.count, 0);

    return { total_value: totalValue, deal_count: dealCount, by_status: byStatus };
  }

  /**
   * Revenue: YTD closed-won revenue for an org.
   */
  async getRevenueSummary(orgId: string, year?: number) {
    const y = year || new Date().getFullYear();

    const result = await db('deals')
      .where('organization_id', orgId)
      .where('status', 'won')
      .whereRaw('EXTRACT(YEAR FROM actual_close_date) = ?', [y])
      .select(
        db.raw('COALESCE(SUM(COALESCE(actual_value, estimated_value, 0)), 0) as ytd_closed_won'),
      )
      .first();

    return {
      ytd_closed_won: parseFloat(result.ytd_closed_won) || 0,
    };
  }

  /**
   * Deal status counts (for the "deals" summary card).
   */
  async getDealStatusCounts(orgId: string, userId?: string) {
    let query = db('deals')
      .select('status')
      .count('* as count')
      .where('organization_id', orgId)
      .groupBy('status');

    if (userId) {
      query = query.where('submitted_by', userId);
    }

    const rows: Array<{ status: string; count: string }> = await query;
    const map: Record<string, number> = {};
    for (const s of ALL_DEAL_STATUSES) map[s] = 0;
    for (const r of rows) map[r.status] = parseInt(r.count as string, 10);

    return {
      submitted: map.submitted,
      approved: map.approved,
      rejected: map.rejected,
      expired: map.expired,
      won: map.won,
      lost: map.lost,
      total_active: map.submitted + map.under_review + map.approved,
    };
  }

  /**
   * Lead performance metrics for an org (or scoped to a user).
   */
  async getLeadMetrics(orgId: string, userId?: string) {
    let query = db('leads')
      .select('status')
      .count('* as count')
      .where('assigned_org_id', orgId);

    if (userId) {
      query = query.where('assigned_user_id', userId);
    }

    query = query.groupBy('status');

    const rows: Array<{ status: string; count: string }> = await query;
    const map: Record<string, number> = {};
    for (const r of rows) map[r.status] = parseInt(r.count as string, 10);

    const assigned = map['assigned'] || 0;
    const accepted = map['accepted'] || 0;
    const contacted = map['contacted'] || 0;
    const qualified = map['qualified'] || 0;
    const converted = map['converted'] || 0;
    const disqualified = map['disqualified'] || 0;
    const returned = map['returned'] || 0;

    const totalReceived = assigned + accepted + contacted + qualified + converted + disqualified + returned;

    // Avg response time (assigned_at to accepted_at)
    let avgQuery = db('leads')
      .where('assigned_org_id', orgId)
      .whereNotNull('assigned_at')
      .whereNotNull('accepted_at')
      .select(
        db.raw('AVG(EXTRACT(EPOCH FROM (accepted_at - assigned_at)) / 3600) as avg_hours'),
      );

    if (userId) {
      avgQuery = avgQuery.where('assigned_user_id', userId);
    }

    const avgResult = await avgQuery.first();
    const avgResponseHours = avgResult?.avg_hours ? Math.round(parseFloat(avgResult.avg_hours) * 10) / 10 : null;

    return {
      assigned,
      accepted: accepted + contacted + qualified,
      converted,
      disqualified,
      conversion_rate: totalReceived > 0
        ? Math.round((converted / totalReceived) * 1000) / 10
        : 0.0,
      avg_response_hours: avgResponseHours,
    };
  }

  /**
   * MDF balance for current quarter.
   */
  async getMdfSummary(orgId: string) {
    const now = new Date();
    const fiscalYear = now.getFullYear();
    const fiscalQuarter = Math.ceil((now.getMonth() + 1) / 3);

    // Get allocation
    const allocation = await db('mdf_allocations')
      .where({ organization_id: orgId, fiscal_year: fiscalYear, fiscal_quarter: fiscalQuarter })
      .select('allocated_amount', 'spent_amount', 'remaining_amount')
      .first();

    const allocated = allocation ? parseFloat(allocation.allocated_amount) || 0 : 0;
    const spent = allocation ? parseFloat(allocation.spent_amount) || 0 : 0;
    const remaining = allocation ? parseFloat(allocation.remaining_amount) || 0 : 0;

    // Get request sums by status
    const requestSums = await db('mdf_requests')
      .where({ organization_id: orgId })
      .whereIn('status', ['submitted', 'approved', 'completed', 'claim_submitted', 'claim_approved', 'reimbursed'])
      .join('mdf_allocations as a', 'mdf_requests.allocation_id', 'a.id')
      .where('a.fiscal_year', fiscalYear)
      .where('a.fiscal_quarter', fiscalQuarter)
      .select(
        db.raw('COALESCE(SUM(CASE WHEN mdf_requests.status = \'submitted\' THEN mdf_requests.requested_amount ELSE 0 END), 0) as pending'),
        db.raw('COALESCE(SUM(CASE WHEN mdf_requests.status IN (\'approved\',\'completed\',\'claim_submitted\',\'claim_approved\',\'reimbursed\') THEN COALESCE(mdf_requests.approved_amount, mdf_requests.requested_amount) ELSE 0 END), 0) as approved'),
        db.raw('COALESCE(SUM(CASE WHEN mdf_requests.status IN (\'claim_submitted\',\'claim_approved\',\'reimbursed\') THEN mdf_requests.claim_amount ELSE 0 END), 0) as claimed'),
        db.raw('COALESCE(SUM(CASE WHEN mdf_requests.status = \'reimbursed\' THEN mdf_requests.reimbursement_amount ELSE 0 END), 0) as reimbursed'),
      )
      .first();

    return {
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      allocated,
      requested: parseFloat(requestSums?.pending) || 0,
      approved: parseFloat(requestSums?.approved) || 0,
      claimed: parseFloat(requestSums?.claimed) || 0,
      reimbursed: parseFloat(requestSums?.reimbursed) || 0,
      remaining,
    };
  }

  /**
   * Certification summary for an org.
   */
  async getCertificationSummary(orgId: string) {
    const now = new Date().toISOString();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Total certified users in this org (passed and not expired)
    const certCount = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('u.organization_id', orgId)
      .where('u.is_active', true)
      .where('uc.status', 'passed')
      .where(function () {
        this.whereNull('uc.expires_at').orWhere('uc.expires_at', '>', now);
      })
      .countDistinct('uc.user_id as count')
      .first();

    // Total active users in org
    const userCount = await db('users')
      .where('organization_id', orgId)
      .where('is_active', true)
      .whereIn('role', ['partner_admin', 'partner_rep'])
      .count('* as count')
      .first();

    // Expiring within 30 days
    const expiringCerts = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .join('courses as c', 'uc.course_id', 'c.id')
      .where('u.organization_id', orgId)
      .where('u.is_active', true)
      .where('uc.status', 'passed')
      .where('uc.expires_at', '>', now)
      .where('uc.expires_at', '<=', thirtyDaysFromNow)
      .select(
        'uc.user_id',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as user_name"),
        'c.name as course_name',
        'uc.expires_at',
      )
      .orderBy('uc.expires_at', 'asc');

    return {
      total_certified: parseInt(certCount?.count as string, 10) || 0,
      total_users: parseInt(userCount?.count as string, 10) || 0,
      expiring_within_30_days: expiringCerts.length,
      expiring_certs: expiringCerts,
    };
  }

  /**
   * Tier progress: current tier, next tier, current metrics, gaps.
   */
  async getTierProgress(orgId: string) {
    // Fetch org with current tier
    const org = await db('organizations as o')
      .leftJoin('partner_tiers as pt', 'o.tier_id', 'pt.id')
      .where('o.id', orgId)
      .select(
        'o.ytd_revenue',
        'o.ytd_deals_closed',
        'o.certified_rep_count',
        'pt.id as tier_id',
        'pt.name as tier_name',
        'pt.rank as tier_rank',
      )
      .first();

    if (!org) return null;

    const currentTier = org.tier_id
      ? { id: org.tier_id, name: org.tier_name, rank: org.tier_rank }
      : null;

    // Fetch next tier (rank + 1)
    let nextTier = null;
    if (currentTier) {
      nextTier = await db('partner_tiers')
        .where('rank', currentTier.rank + 1)
        .select('id', 'name', 'rank', 'min_annual_revenue', 'min_deals_closed', 'min_certified_reps', 'min_csat_score')
        .first();
    }

    const currentMetrics = {
      ytd_revenue: parseFloat(org.ytd_revenue) || 0,
      ytd_deals_closed: org.ytd_deals_closed || 0,
      certified_reps: org.certified_rep_count || 0,
      csat_score: null as number | null,
    };

    if (!nextTier) {
      return {
        current_tier: currentTier,
        next_tier: null,
        current_metrics: currentMetrics,
        gaps: null,
        progress_pct: {
          revenue: 100.0,
          deals: 100.0,
          certs: 100.0,
          csat: null,
        },
      };
    }

    const requirements = {
      min_annual_revenue: parseFloat(nextTier.min_annual_revenue) || 0,
      min_deals_closed: nextTier.min_deals_closed || 0,
      min_certified_reps: nextTier.min_certified_reps || 0,
      min_csat_score: parseFloat(nextTier.min_csat_score) || 0,
    };

    return {
      current_tier: currentTier,
      next_tier: {
        id: nextTier.id,
        name: nextTier.name,
        rank: nextTier.rank,
        requirements,
      },
      current_metrics: currentMetrics,
      gaps: {
        revenue_needed: Math.max(0, requirements.min_annual_revenue - currentMetrics.ytd_revenue),
        deals_needed: Math.max(0, requirements.min_deals_closed - currentMetrics.ytd_deals_closed),
        certs_needed: Math.max(0, requirements.min_certified_reps - currentMetrics.certified_reps),
        csat_needed: null,
      },
      progress_pct: {
        revenue: requirements.min_annual_revenue > 0
          ? Math.min(100, Math.round((currentMetrics.ytd_revenue / requirements.min_annual_revenue) * 1000) / 10)
          : 100.0,
        deals: requirements.min_deals_closed > 0
          ? Math.min(100, Math.round((currentMetrics.ytd_deals_closed / requirements.min_deals_closed) * 1000) / 10)
          : 100.0,
        certs: requirements.min_certified_reps > 0
          ? Math.min(100, Math.round((currentMetrics.certified_reps / requirements.min_certified_reps) * 1000) / 10)
          : 100.0,
        csat: null,
      },
    };
  }

  /**
   * Recent activity feed for an org.
   */
  async getRecentActivity(orgId: string | null, limit: number = 10) {
    let query = db('activity_feed')
      .select('id', 'action', 'entity_type', 'entity_id', 'summary', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (orgId) {
      query = query.where('organization_id', orgId);
    }

    return query;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL MANAGER DASHBOARD QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the org IDs assigned to a channel manager.
   */
  async getAssignedOrgIds(userId: string): Promise<string[]> {
    const orgs = await db('organizations')
      .select('id')
      .where('channel_manager_id', userId);
    return orgs.map((o) => o.id);
  }

  /**
   * Portfolio overview: summary stats for all assigned orgs.
   */
  async getPortfolioSummary(orgIds: string[]) {
    if (orgIds.length === 0) {
      return { total_partners: 0, active_partners: 0, total_pipeline_value: 0, total_ytd_revenue: 0, total_active_deals: 0 };
    }

    const orgStats = await db('organizations')
      .whereIn('id', orgIds)
      .select(
        db.raw('COUNT(*) as total_partners'),
        db.raw("COUNT(*) FILTER (WHERE status = 'active') as active_partners"),
        db.raw('COALESCE(SUM(ytd_revenue), 0) as total_ytd_revenue'),
      )
      .first();

    const dealStats = await db('deals')
      .whereIn('organization_id', orgIds)
      .whereIn('status', ACTIVE_PIPELINE_STATUSES)
      .select(
        db.raw('COALESCE(SUM(estimated_value), 0) as total_pipeline_value'),
        db.raw('COUNT(*) as total_active_deals'),
      )
      .first();

    return {
      total_partners: parseInt(orgStats?.total_partners as string, 10) || 0,
      active_partners: parseInt(orgStats?.active_partners as string, 10) || 0,
      total_pipeline_value: parseFloat(dealStats?.total_pipeline_value) || 0,
      total_ytd_revenue: parseFloat(orgStats?.total_ytd_revenue) || 0,
      total_active_deals: parseInt(dealStats?.total_active_deals as string, 10) || 0,
    };
  }

  /**
   * Pending approvals count for a user.
   */
  async getPendingApprovals(userId?: string) {
    let query = db('approval_requests')
      .select('entity_type')
      .count('* as count')
      .whereNull('action')
      .groupBy('entity_type');

    if (userId) {
      query = query.where('assigned_to', userId);
    }

    const rows: Array<{ entity_type: string; count: string }> = await query;
    const map: Record<string, number> = {};
    for (const r of rows) map[r.entity_type] = parseInt(r.count as string, 10);

    const deals = map['deal'] || 0;
    const quotes = map['quote'] || 0;
    const mdfRequests = map['mdf_request'] || 0;

    return {
      total: deals + quotes + mdfRequests,
      deals,
      quotes,
      mdf_requests: mdfRequests,
    };
  }

  /**
   * Partner portfolio: per-org metrics for CM's assigned orgs.
   */
  async getPartnerPortfolio(orgIds: string[]) {
    if (orgIds.length === 0) return [];

    const orgs = await db('organizations as o')
      .leftJoin('partner_tiers as pt', 'o.tier_id', 'pt.id')
      .whereIn('o.id', orgIds)
      .select(
        'o.id as organization_id',
        'o.name',
        'o.status',
        'o.ytd_revenue',
        'o.certified_rep_count',
        'pt.id as tier_id',
        'pt.name as tier_name',
        'pt.rank as tier_rank',
        'pt.color_hex as tier_color_hex',
        'pt.min_annual_revenue',
      );

    // Batch query: pipeline per org
    const pipelineByOrg = await db('deals')
      .whereIn('organization_id', orgIds)
      .whereIn('status', ACTIVE_PIPELINE_STATUSES)
      .groupBy('organization_id')
      .select(
        'organization_id',
        db.raw('COALESCE(SUM(estimated_value), 0) as pipeline_value'),
        db.raw('COUNT(*) as active_deals'),
      );

    const pipelineMap = new Map(pipelineByOrg.map((r) => [
      r.organization_id,
      { pipeline_value: parseFloat(r.pipeline_value) || 0, active_deals: parseInt(r.active_deals as string, 10) },
    ]));

    // Batch query: open leads per org
    const leadsByOrg = await db('leads')
      .whereIn('assigned_org_id', orgIds)
      .whereIn('status', ['assigned', 'accepted', 'contacted', 'qualified'])
      .groupBy('assigned_org_id')
      .select(
        'assigned_org_id',
        db.raw('COUNT(*) as open_leads'),
      );

    const leadsMap = new Map(leadsByOrg.map((r) => [
      r.assigned_org_id,
      parseInt(r.open_leads as string, 10),
    ]));

    // Batch query: total reps per org
    const repsByOrg = await db('users')
      .whereIn('organization_id', orgIds)
      .where('is_active', true)
      .whereIn('role', ['partner_admin', 'partner_rep'])
      .groupBy('organization_id')
      .select(
        'organization_id',
        db.raw('COUNT(*) as total_reps'),
      );

    const repsMap = new Map(repsByOrg.map((r) => [
      r.organization_id,
      parseInt(r.total_reps as string, 10),
    ]));

    return orgs.map((o) => {
      const pipeline = pipelineMap.get(o.organization_id) || { pipeline_value: 0, active_deals: 0 };
      return {
        organization_id: o.organization_id,
        name: o.name,
        tier: o.tier_id
          ? { id: o.tier_id, name: o.tier_name, rank: o.tier_rank, color_hex: o.tier_color_hex }
          : null,
        status: o.status,
        pipeline_value: pipeline.pipeline_value,
        ytd_revenue: parseFloat(o.ytd_revenue) || 0,
        active_deals: pipeline.active_deals,
        open_leads: leadsMap.get(o.organization_id) || 0,
        certified_reps: o.certified_rep_count || 0,
        total_reps: repsMap.get(o.organization_id) || 0,
        min_annual_revenue: parseFloat(o.min_annual_revenue) || 0,
      };
    });
  }

  /**
   * Lead distribution metrics for CM.
   */
  async getLeadDistributionMetrics(orgIds: string[]) {
    // Unassigned leads (no org scope — CM sees total unassigned)
    const unassigned = await db('leads')
      .where('status', 'new')
      .count('* as count')
      .first();

    // Assigned-pending (assigned to CM's partners)
    const assignedPending = orgIds.length > 0
      ? await db('leads')
        .whereIn('assigned_org_id', orgIds)
        .where('status', 'assigned')
        .count('* as count')
        .first()
      : { count: '0' };

    // Avg acceptance hours
    const avgAcceptance = orgIds.length > 0
      ? await db('leads')
        .whereIn('assigned_org_id', orgIds)
        .whereNotNull('assigned_at')
        .whereNotNull('accepted_at')
        .select(
          db.raw('AVG(EXTRACT(EPOCH FROM (accepted_at - assigned_at)) / 3600) as avg_hours'),
        )
        .first()
      : null;

    // Acceptance rate by partner
    let acceptanceByPartner: any[] = [];
    if (orgIds.length > 0) {
      acceptanceByPartner = await db('leads as l')
        .join('organizations as o', 'l.assigned_org_id', 'o.id')
        .whereIn('l.assigned_org_id', orgIds)
        .whereIn('l.status', ['assigned', 'accepted', 'contacted', 'qualified', 'converted', 'returned', 'disqualified'])
        .groupBy('l.assigned_org_id', 'o.name')
        .select(
          'l.assigned_org_id as organization_id',
          'o.name',
          db.raw('COUNT(*) as assigned'),
          db.raw("COUNT(*) FILTER (WHERE l.status IN ('accepted','contacted','qualified','converted')) as accepted"),
          db.raw("COUNT(*) FILTER (WHERE l.status = 'returned') as returned"),
        );
    }

    return {
      total_unassigned: parseInt(unassigned?.count as string, 10) || 0,
      total_assigned_pending: parseInt(assignedPending?.count as string, 10) || 0,
      avg_acceptance_hours: avgAcceptance?.avg_hours
        ? Math.round(parseFloat(avgAcceptance.avg_hours) * 10) / 10
        : null,
      acceptance_rate_by_partner: acceptanceByPartner.map((r) => {
        const total = parseInt(r.assigned as string, 10);
        const accepted = parseInt(r.accepted as string, 10);
        return {
          organization_id: r.organization_id,
          name: r.name,
          assigned: total,
          accepted,
          returned: parseInt(r.returned as string, 10),
          acceptance_rate: total > 0 ? Math.round((accepted / total) * 1000) / 10 : 0.0,
          avg_response_hours: null as number | null, // per-partner avg would require a subquery
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN DASHBOARD QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Program-wide metrics.
   */
  async getProgramMetrics() {
    const year = new Date().getFullYear();

    const orgCounts = await db('organizations')
      .select(
        db.raw('COUNT(*) as total_partners'),
        db.raw("COUNT(*) FILTER (WHERE status = 'active') as active_partners"),
      )
      .first();

    const dealStats = await db('deals')
      .select(
        db.raw(`COALESCE(SUM(CASE WHEN status IN ('submitted','under_review','approved') THEN estimated_value ELSE 0 END), 0) as total_pipeline_value`),
        db.raw(`COUNT(*) FILTER (WHERE status IN ('submitted','under_review','approved')) as total_active_deals`),
      )
      .first();

    const revenue = await db('deals')
      .where('status', 'won')
      .whereRaw('EXTRACT(YEAR FROM actual_close_date) = ?', [year])
      .select(db.raw('COALESCE(SUM(COALESCE(actual_value, estimated_value, 0)), 0) as total_ytd_revenue'))
      .first();

    const leadCount = await db('leads')
      .whereIn('status', ['assigned', 'accepted', 'contacted', 'qualified'])
      .count('* as count')
      .first();

    const quoteCount = await db('quotes')
      .whereIn('status', ['draft', 'pending_approval', 'approved', 'sent_to_customer'])
      .count('* as count')
      .first();

    return {
      total_partners: parseInt(orgCounts?.total_partners as string, 10) || 0,
      active_partners: parseInt(orgCounts?.active_partners as string, 10) || 0,
      total_pipeline_value: parseFloat(dealStats?.total_pipeline_value) || 0,
      total_ytd_revenue: parseFloat(revenue?.total_ytd_revenue) || 0,
      total_active_deals: parseInt(dealStats?.total_active_deals as string, 10) || 0,
      total_active_leads: parseInt(leadCount?.count as string, 10) || 0,
      total_active_quotes: parseInt(quoteCount?.count as string, 10) || 0,
    };
  }

  /**
   * Tier distribution: count of orgs per tier.
   */
  async getTierDistribution() {
    const rows = await db('partner_tiers as pt')
      .leftJoin('organizations as o', function () {
        this.on('o.tier_id', 'pt.id').andOn(db.raw("o.status = 'active'"));
      })
      .groupBy('pt.id', 'pt.name', 'pt.rank', 'pt.color_hex')
      .orderBy('pt.rank')
      .select(
        'pt.id as tier_id',
        'pt.name as tier_name',
        'pt.rank',
        'pt.color_hex',
        db.raw('COUNT(o.id) as partner_count'),
      );

    return rows.map((r) => ({
      tier_id: r.tier_id,
      tier_name: r.tier_name,
      rank: r.rank,
      color_hex: r.color_hex,
      partner_count: parseInt(r.partner_count as string, 10),
    }));
  }

  /**
   * MDF utilization across the program.
   */
  async getMdfUtilization() {
    const year = new Date().getFullYear();

    const result = await db('mdf_allocations')
      .where('fiscal_year', year)
      .select(
        db.raw('COALESCE(SUM(allocated_amount), 0) as total_allocated'),
        db.raw('COALESCE(SUM(spent_amount), 0) as total_spent'),
        db.raw('COALESCE(SUM(remaining_amount), 0) as total_remaining'),
      )
      .first();

    const totalAllocated = parseFloat(result?.total_allocated) || 0;
    const totalSpent = parseFloat(result?.total_spent) || 0;
    const totalRemaining = parseFloat(result?.total_remaining) || 0;

    // Approved amounts from requests
    const approvedResult = await db('mdf_requests')
      .join('mdf_allocations as a', 'mdf_requests.allocation_id', 'a.id')
      .where('a.fiscal_year', year)
      .whereIn('mdf_requests.status', ['approved', 'completed', 'claim_submitted', 'claim_approved', 'reimbursed'])
      .select(
        db.raw('COALESCE(SUM(COALESCE(mdf_requests.approved_amount, mdf_requests.requested_amount)), 0) as total_approved'),
      )
      .first();

    return {
      total_allocated: totalAllocated,
      total_approved: parseFloat(approvedResult?.total_approved) || 0,
      total_spent: totalSpent,
      total_remaining: totalRemaining,
      utilization_pct: totalAllocated > 0
        ? Math.round((totalSpent / totalAllocated) * 1000) / 10
        : 0.0,
    };
  }

  /**
   * Certification coverage: overall and by tier.
   */
  async getCertCoverage() {
    const now = new Date().toISOString();

    // Overall counts
    const overall = await db('users')
      .whereIn('role', ['partner_admin', 'partner_rep'])
      .where('is_active', true)
      .whereNotNull('organization_id')
      .select(db.raw('COUNT(*) as total_partner_users'))
      .first();

    const certifiedUsers = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('u.is_active', true)
      .whereNotNull('u.organization_id')
      .whereIn('u.role', ['partner_admin', 'partner_rep'])
      .where('uc.status', 'passed')
      .where(function () {
        this.whereNull('uc.expires_at').orWhere('uc.expires_at', '>', now);
      })
      .countDistinct('uc.user_id as count')
      .first();

    const totalUsers = parseInt(overall?.total_partner_users as string, 10) || 0;
    const totalCertified = parseInt(certifiedUsers?.count as string, 10) || 0;

    // By tier
    const byTier = await db('partner_tiers as pt')
      .leftJoin('organizations as o', function () {
        this.on('o.tier_id', 'pt.id').andOn(db.raw("o.status = 'active'"));
      })
      .groupBy('pt.id', 'pt.name', 'pt.min_certified_reps')
      .select(
        'pt.id as tier_id',
        'pt.name as tier_name',
        'pt.min_certified_reps as required_certs',
        db.raw('COUNT(o.id) as partners_total'),
        db.raw(`COUNT(o.id) FILTER (WHERE COALESCE(o.certified_rep_count, 0) >= pt.min_certified_reps) as partners_meeting_requirement`),
      );

    return {
      total_certified_users: totalCertified,
      total_partner_users: totalUsers,
      overall_pct: totalUsers > 0
        ? Math.round((totalCertified / totalUsers) * 1000) / 10
        : 0.0,
      by_tier: byTier.map((r) => {
        const total = parseInt(r.partners_total as string, 10);
        const meeting = parseInt(r.partners_meeting_requirement as string, 10);
        return {
          tier_id: r.tier_id,
          tier_name: r.tier_name,
          required_certs: r.required_certs,
          partners_meeting_requirement: meeting,
          partners_total: total,
          coverage_pct: total > 0 ? Math.round((meeting / total) * 1000) / 10 : 0.0,
        };
      }),
    };
  }

  /**
   * Top partners by metric.
   */
  async getTopPartners(limit: number = 10) {
    const year = new Date().getFullYear();

    // By revenue
    const byRevenue = await db('organizations as o')
      .leftJoin('partner_tiers as pt', 'o.tier_id', 'pt.id')
      .where('o.status', 'active')
      .where('o.ytd_revenue', '>', 0)
      .orderBy('o.ytd_revenue', 'desc')
      .limit(limit)
      .select(
        'o.id as organization_id',
        'o.name',
        'pt.name as tier_name',
        'o.ytd_revenue',
      );

    // By deal count (won deals this year)
    const byDealCount = await db('deals')
      .join('organizations as o', 'deals.organization_id', 'o.id')
      .leftJoin('partner_tiers as pt', 'o.tier_id', 'pt.id')
      .where('o.status', 'active')
      .where('deals.status', 'won')
      .whereRaw('EXTRACT(YEAR FROM deals.actual_close_date) = ?', [year])
      .groupBy('o.id', 'o.name', 'pt.name')
      .orderBy('deal_count', 'desc')
      .limit(limit)
      .select(
        'o.id as organization_id',
        'o.name',
        'pt.name as tier_name',
        db.raw('COUNT(*) as deal_count'),
      );

    // By lead conversion (min 5 leads to avoid noise)
    const byLeadConversion = await db('leads')
      .join('organizations as o', 'leads.assigned_org_id', 'o.id')
      .leftJoin('partner_tiers as pt', 'o.tier_id', 'pt.id')
      .where('o.status', 'active')
      .whereIn('leads.status', ['assigned', 'accepted', 'contacted', 'qualified', 'converted', 'returned', 'disqualified'])
      .groupBy('o.id', 'o.name', 'pt.name')
      .havingRaw('COUNT(*) >= 5')
      .orderBy('conversion_rate', 'desc')
      .limit(limit)
      .select(
        'o.id as organization_id',
        'o.name',
        'pt.name as tier_name',
        db.raw("ROUND(COUNT(*) FILTER (WHERE leads.status = 'converted')::numeric / COUNT(*)::numeric * 100, 1) as conversion_rate"),
      );

    return {
      by_revenue: byRevenue.map((r) => ({
        organization_id: r.organization_id,
        name: r.name,
        tier_name: r.tier_name,
        ytd_revenue: parseFloat(r.ytd_revenue) || 0,
      })),
      by_deal_count: byDealCount.map((r) => ({
        organization_id: r.organization_id,
        name: r.name,
        tier_name: r.tier_name,
        deal_count: parseInt(r.deal_count as string, 10),
      })),
      by_lead_conversion: byLeadConversion.map((r) => ({
        organization_id: r.organization_id,
        name: r.name,
        tier_name: r.tier_name,
        conversion_rate: parseFloat(r.conversion_rate as string) || 0,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pipeline analytics with grouping.
   */
  async getPipelineAnalytics(filters: {
    startDate: string;
    endDate: string;
    orgIds: string[] | null;
    orgId?: string;
    productId?: string;
    groupBy: string;
  }) {
    const { startDate, endDate, orgIds, orgId, productId, groupBy } = filters;

    // Base filter
    const baseQuery = () => {
      let q = db('deals')
        .where('deals.created_at', '>=', startDate)
        .where('deals.created_at', '<=', endDate);

      q = applyOrgFilter(q, orgIds, 'deals.organization_id');
      if (orgId) q = q.where('deals.organization_id', orgId);
      if (productId) q = q.where('deals.primary_product_id', productId);
      return q;
    };

    // Totals
    const totals = await baseQuery()
      .select(
        db.raw('COALESCE(SUM(estimated_value), 0) as total_pipeline_value'),
        db.raw('COUNT(*) as total_deal_count'),
      )
      .first();

    // Groups
    let groupsQuery: Knex.QueryBuilder;
    if (groupBy === 'status') {
      groupsQuery = baseQuery()
        .select(
          'status as key',
          'status as label',
          db.raw('COUNT(*) as deal_count'),
          db.raw('COALESCE(SUM(estimated_value), 0) as total_value'),
          db.raw('COALESCE(AVG(estimated_value), 0) as avg_value'),
          db.raw('COALESCE(AVG(win_probability), 0) as avg_win_probability'),
        )
        .groupBy('status');
    } else if (groupBy === 'organization') {
      groupsQuery = baseQuery()
        .join('organizations as o', 'deals.organization_id', 'o.id')
        .select(
          'deals.organization_id as key',
          'o.name as label',
          db.raw('COUNT(*) as deal_count'),
          db.raw('COALESCE(SUM(deals.estimated_value), 0) as total_value'),
          db.raw('COALESCE(AVG(deals.estimated_value), 0) as avg_value'),
          db.raw('COALESCE(AVG(deals.win_probability), 0) as avg_win_probability'),
        )
        .groupBy('deals.organization_id', 'o.name')
        .orderBy('total_value', 'desc');
    } else if (groupBy === 'product') {
      groupsQuery = baseQuery()
        .leftJoin('products as p', 'deals.primary_product_id', 'p.id')
        .select(
          db.raw("COALESCE(deals.primary_product_id::text, 'unassigned') as key"),
          db.raw("COALESCE(p.name, 'Unassigned') as label"),
          db.raw('COUNT(*) as deal_count'),
          db.raw('COALESCE(SUM(deals.estimated_value), 0) as total_value'),
          db.raw('COALESCE(AVG(deals.estimated_value), 0) as avg_value'),
          db.raw('COALESCE(AVG(deals.win_probability), 0) as avg_win_probability'),
        )
        .groupBy('deals.primary_product_id', 'p.name')
        .orderBy('total_value', 'desc');
    } else {
      // month
      groupsQuery = baseQuery()
        .select(
          db.raw("TO_CHAR(deals.created_at, 'YYYY-MM') as key"),
          db.raw("TO_CHAR(deals.created_at, 'YYYY-MM') as label"),
          db.raw('COUNT(*) as deal_count'),
          db.raw('COALESCE(SUM(deals.estimated_value), 0) as total_value'),
          db.raw('COALESCE(AVG(deals.estimated_value), 0) as avg_value'),
          db.raw('COALESCE(AVG(deals.win_probability), 0) as avg_win_probability'),
        )
        .groupByRaw("TO_CHAR(deals.created_at, 'YYYY-MM')")
        .orderBy('key', 'asc');
    }

    const groups = await groupsQuery;

    // Monthly trend (always)
    const trend = await baseQuery()
      .select(
        db.raw("TO_CHAR(deals.created_at, 'YYYY-MM') as period"),
        db.raw('COUNT(*) as deal_count'),
        db.raw('COALESCE(SUM(deals.estimated_value), 0) as total_value'),
      )
      .groupByRaw("TO_CHAR(deals.created_at, 'YYYY-MM')")
      .orderBy('period', 'asc');

    return {
      total_pipeline_value: parseFloat(totals?.total_pipeline_value) || 0,
      total_deal_count: parseInt(totals?.total_deal_count as string, 10) || 0,
      groups: groups.map((g: any) => ({
        key: g.key,
        label: g.label,
        deal_count: parseInt(g.deal_count as string, 10),
        total_value: parseFloat(g.total_value) || 0,
        avg_value: Math.round((parseFloat(g.avg_value) || 0) * 100) / 100,
        avg_win_probability: Math.round(parseFloat(g.avg_win_probability) || 0),
      })),
      trend: trend.map((t: any) => ({
        period: t.period,
        deal_count: parseInt(t.deal_count as string, 10),
        total_value: parseFloat(t.total_value) || 0,
      })),
    };
  }

  /**
   * Partner performance analytics.
   */
  async getPartnerPerformanceData(filters: {
    orgIds: string[] | null;
    orgId?: string;
    tierId?: string;
    limit: number;
    offset: number;
  }) {
    const { orgIds, orgId, tierId, limit, offset } = filters;
    const year = new Date().getFullYear();

    let countQuery = db('organizations as o')
      .where('o.status', 'active');
    countQuery = applyOrgFilter(countQuery, orgIds, 'o.id');
    if (orgId) countQuery = countQuery.where('o.id', orgId);
    if (tierId) countQuery = countQuery.where('o.tier_id', tierId);

    const totalResult = await countQuery.count('* as count').first();
    const total = parseInt(totalResult?.count as string, 10) || 0;

    let query = db('organizations as o')
      .leftJoin('partner_tiers as pt', 'o.tier_id', 'pt.id')
      .where('o.status', 'active');

    query = applyOrgFilter(query, orgIds, 'o.id');
    if (orgId) query = query.where('o.id', orgId);
    if (tierId) query = query.where('o.tier_id', tierId);

    const orgs = await query
      .select(
        'o.id',
        'o.name',
        'o.ytd_revenue',
        'o.ytd_deals_closed',
        'o.certified_rep_count',
        'pt.id as tier_id',
        'pt.name as tier_name',
        'pt.rank as tier_rank',
        'pt.min_annual_revenue',
      )
      .limit(limit)
      .offset(offset);

    if (orgs.length === 0) return { partners: [], total };

    const orgIdList = orgs.map((o: any) => o.id);

    // Deal stats per org
    const dealStats = await db('deals')
      .whereIn('organization_id', orgIdList)
      .groupBy('organization_id')
      .select(
        'organization_id',
        db.raw('COUNT(*) as total_deals'),
        db.raw("COUNT(*) FILTER (WHERE status = 'won') as won_deals"),
        db.raw("COUNT(*) FILTER (WHERE status = 'lost') as lost_deals"),
        db.raw("COALESCE(AVG(CASE WHEN status = 'won' THEN actual_value END), 0) as avg_deal_size"),
        db.raw("AVG(CASE WHEN status IN ('won','lost') AND actual_close_date IS NOT NULL THEN EXTRACT(DAY FROM (actual_close_date - created_at::date)) END) as avg_cycle_days"),
      );

    const dealMap = new Map(dealStats.map((d: any) => [d.organization_id, d]));

    // Lead stats per org
    const leadStats = await db('leads')
      .whereIn('assigned_org_id', orgIdList)
      .groupBy('assigned_org_id')
      .select(
        'assigned_org_id',
        db.raw('COUNT(*) as total_assigned'),
        db.raw("COUNT(*) FILTER (WHERE status = 'converted') as converted"),
        db.raw("AVG(CASE WHEN accepted_at IS NOT NULL AND assigned_at IS NOT NULL THEN EXTRACT(EPOCH FROM (accepted_at - assigned_at)) / 3600 END) as avg_response_hours"),
        db.raw("COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL AND accepted_at IS NOT NULL AND accepted_at <= sla_deadline) as sla_met"),
        db.raw("COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL) as sla_total"),
      );

    const leadMap = new Map(leadStats.map((l: any) => [l.assigned_org_id, l]));

    // MDF stats per org
    const mdfStats = await db('mdf_allocations')
      .whereIn('organization_id', orgIdList)
      .where('fiscal_year', year)
      .groupBy('organization_id')
      .select(
        'organization_id',
        db.raw('COALESCE(SUM(allocated_amount), 0) as allocated'),
        db.raw('COALESCE(SUM(spent_amount), 0) as spent'),
      );

    const mdfMap = new Map(mdfStats.map((m: any) => [m.organization_id, m]));

    // Rep counts per org
    const repCounts = await db('users')
      .whereIn('organization_id', orgIdList)
      .where('is_active', true)
      .whereIn('role', ['partner_admin', 'partner_rep'])
      .groupBy('organization_id')
      .select('organization_id', db.raw('COUNT(*) as total_reps'));

    const repMap = new Map(repCounts.map((r: any) => [r.organization_id, parseInt(r.total_reps as string, 10)]));

    return {
      partners: orgs.map((o: any) => {
        const ds = dealMap.get(o.id) || { total_deals: '0', won_deals: '0', lost_deals: '0', avg_deal_size: '0', avg_cycle_days: null };
        const ls = leadMap.get(o.id) || { total_assigned: '0', converted: '0', avg_response_hours: null, sla_met: '0', sla_total: '0' };
        const ms = mdfMap.get(o.id) || { allocated: '0', spent: '0' };
        const totalReps = repMap.get(o.id) || 0;
        const certReps = o.certified_rep_count || 0;

        const won = parseInt(ds.won_deals as string, 10);
        const lost = parseInt(ds.lost_deals as string, 10);
        const closed = won + lost;
        const totalLeads = parseInt(ls.total_assigned as string, 10);
        const convertedLeads = parseInt(ls.converted as string, 10);
        const mdfAllocated = parseFloat(ms.allocated) || 0;
        const mdfSpent = parseFloat(ms.spent) || 0;
        const slaMet = parseInt(ls.sla_met as string, 10);
        const slaTotal = parseInt(ls.sla_total as string, 10);
        const minRevenue = parseFloat(o.min_annual_revenue) || 0;
        const ytdRevenue = parseFloat(o.ytd_revenue) || 0;

        return {
          organization_id: o.id,
          name: o.name,
          tier: o.tier_id ? { id: o.tier_id, name: o.tier_name, rank: o.tier_rank } : null,
          metrics: {
            ytd_revenue: ytdRevenue,
            revenue_attainment_pct: minRevenue > 0 ? Math.round((ytdRevenue / minRevenue) * 1000) / 10 : 0.0,
            total_deals: parseInt(ds.total_deals as string, 10),
            won_deals: won,
            lost_deals: lost,
            win_rate: closed >= 3 ? Math.round((won / closed) * 1000) / 10 : null,
            avg_deal_size: Math.round((parseFloat(ds.avg_deal_size as string) || 0) * 100) / 100,
            avg_deal_cycle_days: ds.avg_cycle_days != null ? Math.round(parseFloat(ds.avg_cycle_days as string)) : null,
            total_leads_assigned: totalLeads,
            leads_converted: convertedLeads,
            lead_conversion_rate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0.0,
            avg_lead_response_hours: ls.avg_response_hours != null
              ? Math.round(parseFloat(ls.avg_response_hours as string) * 10) / 10
              : null,
            sla_compliance_pct: slaTotal > 0 ? Math.round((slaMet / slaTotal) * 1000) / 10 : 0.0,
            mdf_allocated: mdfAllocated,
            mdf_spent: mdfSpent,
            mdf_utilization_pct: mdfAllocated > 0 ? Math.round((mdfSpent / mdfAllocated) * 1000) / 10 : 0.0,
            certified_reps: certReps,
            total_reps: totalReps,
            cert_coverage_pct: totalReps > 0 ? Math.round((certReps / totalReps) * 1000) / 10 : 0.0,
          },
        };
      }),
      total,
    };
  }

  /**
   * Lead conversion funnel analytics.
   */
  async getLeadConversionAnalytics(filters: {
    startDate: string;
    endDate: string;
    orgIds: string[] | null;
    orgId?: string;
    source?: string;
  }) {
    const { startDate, endDate, orgIds, orgId, source } = filters;

    const baseQuery = () => {
      let q = db('leads')
        .where('leads.created_at', '>=', startDate)
        .where('leads.created_at', '<=', endDate);

      q = applyOrgFilter(q, orgIds, 'leads.assigned_org_id');
      if (orgId) q = q.where('leads.assigned_org_id', orgId);
      if (source) q = q.where('leads.source', source);
      return q;
    };

    // Stage order for funnel (cumulative: leads that reached each stage)
    const STAGE_ORDER = ['new', 'assigned', 'accepted', 'contacted', 'qualified', 'converted'];
    const STAGE_MAP: Record<string, string[]> = {
      new: ['new', 'assigned', 'accepted', 'contacted', 'qualified', 'converted', 'disqualified', 'returned'],
      assigned: ['assigned', 'accepted', 'contacted', 'qualified', 'converted', 'returned'],
      accepted: ['accepted', 'contacted', 'qualified', 'converted'],
      contacted: ['contacted', 'qualified', 'converted'],
      qualified: ['qualified', 'converted'],
      converted: ['converted'],
    };

    // Total count for pct_of_total base
    const totalResult = await baseQuery().count('* as count').first();
    const totalCount = parseInt(totalResult?.count as string, 10) || 0;

    // Count by current status for funnel
    const statusCounts = await baseQuery()
      .select('status', db.raw('COUNT(*) as count'))
      .groupBy('status');

    const statusMap: Record<string, number> = {};
    for (const r of statusCounts) {
      statusMap[r.status] = parseInt(r.count as string, 10);
    }

    // Build funnel (cumulative)
    const funnel = STAGE_ORDER.map((stage) => {
      const reachedStatuses = STAGE_MAP[stage];
      const count = reachedStatuses.reduce((sum, s) => sum + (statusMap[s] || 0), 0);
      return {
        stage,
        count,
        pct_of_total: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0.0,
      };
    });

    // Drop-off
    const returned = statusMap['returned'] || 0;
    const disqualified = statusMap['disqualified'] || 0;
    const dropOff: Array<{ from: string; to: string; count: number }> = [];
    if (returned > 0) dropOff.push({ from: 'assigned', to: 'returned', count: returned });
    if (disqualified > 0) dropOff.push({ from: 'contacted', to: 'disqualified', count: disqualified });

    // By source
    const bySource = await baseQuery()
      .select(
        'leads.source',
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(*) FILTER (WHERE leads.status = 'converted') as converted"),
      )
      .whereNotNull('leads.source')
      .groupBy('leads.source')
      .orderByRaw("COUNT(*) FILTER (WHERE leads.status = 'converted')::numeric / NULLIF(COUNT(*), 0) DESC NULLS LAST");

    // Avg time between stages
    const timingResult = await baseQuery()
      .select(
        db.raw('AVG(CASE WHEN leads.assigned_at IS NOT NULL THEN EXTRACT(EPOCH FROM (leads.assigned_at - leads.created_at)) / 3600 END) as new_to_assigned_hours'),
        db.raw('AVG(CASE WHEN leads.accepted_at IS NOT NULL AND leads.assigned_at IS NOT NULL THEN EXTRACT(EPOCH FROM (leads.accepted_at - leads.assigned_at)) / 3600 END) as assigned_to_accepted_hours'),
        db.raw('AVG(CASE WHEN leads.converted_at IS NOT NULL AND leads.accepted_at IS NOT NULL THEN EXTRACT(EPOCH FROM (leads.converted_at - leads.accepted_at)) / 86400 END) as accepted_to_converted_days'),
      )
      .first();

    // Monthly trend
    const trend = await baseQuery()
      .select(
        db.raw("TO_CHAR(leads.created_at, 'YYYY-MM') as period"),
        db.raw('COUNT(*) as new'),
        db.raw("COUNT(*) FILTER (WHERE leads.status = 'converted') as converted"),
      )
      .groupByRaw("TO_CHAR(leads.created_at, 'YYYY-MM')")
      .orderBy('period', 'asc');

    return {
      funnel,
      drop_off: dropOff,
      by_source: bySource.map((r: any) => {
        const total = parseInt(r.total as string, 10);
        const converted = parseInt(r.converted as string, 10);
        return {
          source: r.source,
          total,
          converted,
          conversion_rate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0.0,
        };
      }),
      avg_time_between_stages: {
        new_to_assigned_hours: timingResult?.new_to_assigned_hours != null
          ? Math.round(parseFloat(timingResult.new_to_assigned_hours) * 10) / 10
          : null,
        assigned_to_accepted_hours: timingResult?.assigned_to_accepted_hours != null
          ? Math.round(parseFloat(timingResult.assigned_to_accepted_hours) * 10) / 10
          : null,
        accepted_to_converted_days: timingResult?.accepted_to_converted_days != null
          ? Math.round(parseFloat(timingResult.accepted_to_converted_days) * 10) / 10
          : null,
      },
      trend: trend.map((t: any) => {
        const total = parseInt(t.new as string, 10);
        const converted = parseInt(t.converted as string, 10);
        return {
          period: t.period,
          new: total,
          converted,
          conversion_rate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0.0,
        };
      }),
    };
  }

  /**
   * MDF ROI analytics.
   */
  async getMdfRoiAnalytics(filters: {
    fiscalYear: number;
    fiscalQuarter?: number;
    orgIds: string[] | null;
    orgId?: string;
    activityType?: string;
  }) {
    const { fiscalYear, fiscalQuarter, orgIds, orgId, activityType } = filters;

    const baseQuery = () => {
      let q = db('mdf_requests as mr')
        .join('mdf_allocations as ma', 'mr.allocation_id', 'ma.id')
        .where('ma.fiscal_year', fiscalYear);

      if (fiscalQuarter) q = q.where('ma.fiscal_quarter', fiscalQuarter);
      q = applyOrgFilter(q, orgIds, 'mr.organization_id');
      if (orgId) q = q.where('mr.organization_id', orgId);
      if (activityType) q = q.where('mr.activity_type', activityType);
      return q;
    };

    // Summary
    const summary = await baseQuery()
      .select(
        db.raw('COALESCE(SUM(COALESCE(mr.approved_amount, mr.requested_amount)) FILTER (WHERE mr.status IN (\'approved\',\'completed\',\'claim_submitted\',\'claim_approved\',\'reimbursed\')), 0) as total_approved'),
        db.raw('COALESCE(SUM(mr.claim_amount) FILTER (WHERE mr.status IN (\'claim_submitted\',\'claim_approved\',\'reimbursed\')), 0) as total_claimed'),
        db.raw('COALESCE(SUM(mr.reimbursement_amount) FILTER (WHERE mr.status = \'reimbursed\'), 0) as total_reimbursed'),
      )
      .first();

    // Total allocated for the period
    const allocQuery = db('mdf_allocations')
      .where('fiscal_year', fiscalYear);
    if (fiscalQuarter) allocQuery.where('fiscal_quarter', fiscalQuarter);
    const allocOrgFilter = orgIds || (orgId ? [orgId] : null);
    const allocResult = await applyOrgFilter(allocQuery, allocOrgFilter)
      .select(db.raw('COALESCE(SUM(allocated_amount), 0) as total_allocated'))
      .first();

    const totalReimbursed = parseFloat(summary?.total_reimbursed) || 0;

    // Associated revenue: deals won within 90 days of MDF activity end_date
    // Simplified: get revenue per org that has reimbursed MDF
    const revenueResult = await db.raw(`
      SELECT COALESCE(SUM(d.actual_value), 0) as associated_revenue
      FROM deals d
      WHERE d.status = 'won'
        AND EXISTS (
          SELECT 1 FROM mdf_requests mr
          JOIN mdf_allocations ma ON mr.allocation_id = ma.id
          WHERE mr.organization_id = d.organization_id
            AND mr.status = 'reimbursed'
            AND ma.fiscal_year = ?
            ${fiscalQuarter ? 'AND ma.fiscal_quarter = ?' : ''}
            AND d.actual_close_date BETWEEN mr.start_date AND (mr.end_date + INTERVAL '90 days')
        )
    `, fiscalQuarter ? [fiscalYear, fiscalQuarter] : [fiscalYear]);

    const associatedRevenue = parseFloat(revenueResult.rows[0]?.associated_revenue) || 0;

    // By activity type
    const byActivityType = await baseQuery()
      .whereIn('mr.status', ['approved', 'completed', 'claim_submitted', 'claim_approved', 'reimbursed'])
      .groupBy('mr.activity_type')
      .select(
        'mr.activity_type',
        db.raw('COUNT(*) as request_count'),
        db.raw('COALESCE(SUM(COALESCE(mr.approved_amount, mr.requested_amount)), 0) as total_approved'),
        db.raw("COALESCE(SUM(mr.reimbursement_amount) FILTER (WHERE mr.status = 'reimbursed'), 0) as total_reimbursed"),
      );

    // By quarter
    const byQuarter = await db('mdf_allocations as ma')
      .where('ma.fiscal_year', fiscalYear)
      .modify((q) => {
        if (fiscalQuarter) q.where('ma.fiscal_quarter', fiscalQuarter);
        applyOrgFilter(q, orgIds || (orgId ? [orgId] : null), 'ma.organization_id');
      })
      .groupBy('ma.fiscal_year', 'ma.fiscal_quarter')
      .orderBy('ma.fiscal_quarter')
      .select(
        'ma.fiscal_year',
        'ma.fiscal_quarter',
        db.raw('COALESCE(SUM(ma.allocated_amount), 0) as allocated'),
        db.raw('COALESCE(SUM(ma.spent_amount), 0) as spent'),
      );

    // By partner
    const byPartner = await baseQuery()
      .join('organizations as o', 'mr.organization_id', 'o.id')
      .leftJoin('partner_tiers as pt', 'o.tier_id', 'pt.id')
      .where('mr.status', 'reimbursed')
      .groupBy('mr.organization_id', 'o.name', 'pt.name')
      .select(
        'mr.organization_id',
        'o.name',
        'pt.name as tier_name',
        db.raw('COALESCE(SUM(mr.reimbursement_amount), 0) as total_reimbursed'),
      );

    return {
      summary: {
        total_allocated: parseFloat(allocResult?.total_allocated) || 0,
        total_approved: parseFloat(summary?.total_approved) || 0,
        total_claimed: parseFloat(summary?.total_claimed) || 0,
        total_reimbursed: totalReimbursed,
        associated_revenue: associatedRevenue,
        roi_ratio: totalReimbursed > 0
          ? Math.round((associatedRevenue / totalReimbursed) * 10) / 10
          : null,
      },
      by_activity_type: byActivityType.map((r: any) => {
        const reimbursed = parseFloat(r.total_reimbursed) || 0;
        return {
          activity_type: r.activity_type,
          request_count: parseInt(r.request_count as string, 10),
          total_approved: parseFloat(r.total_approved) || 0,
          total_reimbursed: reimbursed,
          associated_revenue: 0, // would need per-type correlation
          roi_ratio: reimbursed > 0 ? null : null, // simplified
        };
      }),
      by_quarter: byQuarter.map((r: any) => ({
        fiscal_year: r.fiscal_year,
        fiscal_quarter: r.fiscal_quarter,
        allocated: parseFloat(r.allocated) || 0,
        approved: 0,
        reimbursed: parseFloat(r.spent) || 0,
        associated_revenue: 0,
        roi_ratio: null,
      })),
      by_partner: byPartner.map((r: any) => {
        const reimbursed = parseFloat(r.total_reimbursed) || 0;
        return {
          organization_id: r.organization_id,
          name: r.name,
          tier_name: r.tier_name,
          total_allocated: 0,
          total_reimbursed: reimbursed,
          associated_revenue: 0,
          roi_ratio: null,
        };
      }),
    };
  }
}

export default new DashboardRepository();
