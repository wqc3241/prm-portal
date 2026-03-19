import dashboardRepository from '../repositories/dashboard.repository';
import { AppError } from '../utils/AppError';
import { JwtPayload, OrgScope } from '../types/express';
import { HEALTH_SCORE_WEIGHTS, HEALTH_SCORE_THRESHOLDS } from '../config/constants';

// ─── Safe division utilities ──────────────────────────────────────────────────

function safePct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0.0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10) / 10;
}

// ─── Org ID helpers from scope ───────────────────────────────────────────────

function getOrgIdsFromScope(scope: OrgScope): string[] | null {
  if (scope.type === 'all') return null; // admin — no filter
  if (scope.type === 'assigned') return scope.assignedOrgIds || [];
  if (scope.type === 'own' && scope.organizationId) return [scope.organizationId];
  return [];
}

// ─── Health score calculation ─────────────────────────────────────────────────

function computeHealthScore(partner: any): number {
  const weights = { ...HEALTH_SCORE_WEIGHTS };
  const scores: Record<string, number | null> = {};

  // Revenue attainment (0-100)
  if (partner.min_annual_revenue > 0) {
    const attainment = (partner.ytd_revenue / partner.min_annual_revenue) * 100;
    scores.revenue_attainment = Math.min(100, attainment);
  } else {
    scores.revenue_attainment = null;
  }

  // Deal win rate (0-100) — need at least some deals
  const won = partner.won_deals || 0;
  const lost = partner.lost_deals || 0;
  const closed = won + lost;
  if (closed >= 3) {
    scores.deal_win_rate = (won / closed) * 100;
  } else {
    scores.deal_win_rate = null;
  }

  // Lead acceptance rate (0-100)
  if (partner.total_leads > 0) {
    scores.lead_acceptance_rate = (partner.accepted_leads / partner.total_leads) * 100;
  } else {
    scores.lead_acceptance_rate = null;
  }

  // Lead response time (0-100): excellent < 4h = 100, poor > 48h = 0
  if (partner.avg_response_hours != null) {
    const { lead_response_excellent_hours, lead_response_poor_hours } = HEALTH_SCORE_THRESHOLDS;
    if (partner.avg_response_hours <= lead_response_excellent_hours) {
      scores.lead_response_time = 100;
    } else if (partner.avg_response_hours >= lead_response_poor_hours) {
      scores.lead_response_time = 0;
    } else {
      const range = lead_response_poor_hours - lead_response_excellent_hours;
      scores.lead_response_time = 100 - ((partner.avg_response_hours - lead_response_excellent_hours) / range) * 100;
    }
  } else {
    scores.lead_response_time = null;
  }

  // Cert coverage (0-100)
  if (partner.total_reps > 0) {
    scores.cert_coverage = Math.min(100, (partner.certified_reps / partner.total_reps) * 100);
  } else {
    scores.cert_coverage = null;
  }

  // MDF utilization (0-100)
  if (partner.mdf_allocated > 0) {
    scores.mdf_utilization = Math.min(100, (partner.mdf_spent / partner.mdf_allocated) * 100);
  } else {
    scores.mdf_utilization = null;
  }

  // Redistribute weights for null metrics
  const weightKeys = Object.keys(weights) as Array<keyof typeof weights>;
  let nullWeight = 0;
  let activeCount = 0;
  for (const key of weightKeys) {
    if (scores[key] === null) {
      nullWeight += weights[key];
    } else {
      activeCount++;
    }
  }

  if (activeCount === 0) return 50; // no data → neutral score

  const redistribution = nullWeight / activeCount;

  let totalScore = 0;
  for (const key of weightKeys) {
    if (scores[key] !== null) {
      totalScore += scores[key]! * (weights[key] + redistribution);
    }
  }

  return Math.round(totalScore);
}

class DashboardService {
  // ═══════════════════════════════════════════════════════════════════════════
  // PARTNER DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  async getPartnerDashboard(user: JwtPayload) {
    const orgId = user.org_id;
    if (!orgId) {
      throw AppError.forbidden('User is not associated with an organization', 'AUTH_ORG_MISMATCH');
    }

    // partner_rep scopes deals/leads to own user_id
    const userId = user.role === 'partner_rep' ? user.sub : undefined;

    const warnings: string[] = [];

    // Execute all queries in parallel, catch individual failures (NFR-REL-001)
    const results = await Promise.allSettled([
      dashboardRepository.getPipelineSummary(orgId, userId),        // 0
      dashboardRepository.getRevenueSummary(orgId),                 // 1
      dashboardRepository.getDealStatusCounts(orgId, userId),       // 2
      dashboardRepository.getLeadMetrics(orgId, userId),            // 3
      dashboardRepository.getMdfSummary(orgId),                     // 4
      dashboardRepository.getCertificationSummary(orgId),           // 5
      dashboardRepository.getTierProgress(orgId),                   // 6
      dashboardRepository.getRecentActivity(orgId, 10),             // 7
    ]);

    const extract = <T>(index: number, section: string, fallback: T): T => {
      const r = results[index];
      if (r.status === 'fulfilled') return r.value as T;
      warnings.push(`Failed to load ${section}`);
      console.error(`Dashboard section '${section}' failed:`, r.reason);
      return fallback;
    };

    const pipeline = extract(0, 'pipeline', { total_value: 0, deal_count: 0, by_status: [] });
    const revenue = extract(1, 'revenue', { ytd_closed_won: 0 });
    const deals = extract(2, 'deals', { submitted: 0, approved: 0, rejected: 0, expired: 0, won: 0, lost: 0, total_active: 0 });
    const leads = extract(3, 'leads', { assigned: 0, accepted: 0, converted: 0, disqualified: 0, conversion_rate: 0.0, avg_response_hours: null });
    const mdf = extract(4, 'mdf', { fiscal_year: new Date().getFullYear(), fiscal_quarter: Math.ceil((new Date().getMonth() + 1) / 3), allocated: 0, requested: 0, approved: 0, claimed: 0, reimbursed: 0, remaining: 0 });
    const certs = extract(5, 'certifications', { total_certified: 0, total_users: 0, expiring_within_30_days: 0, expiring_certs: [] });
    const tierProgress = extract<any>(6, 'tier_progress', null);
    const recentActivity = extract(7, 'recent_activity', []);

    // Compute revenue attainment
    const tierTarget = tierProgress?.next_tier?.requirements?.min_annual_revenue
      || tierProgress?.current_metrics?.ytd_revenue
      || 0;

    const data: any = {
      pipeline,
      revenue: {
        ytd_closed_won: revenue.ytd_closed_won,
        tier_target: tierTarget,
        attainment_pct: tierTarget > 0
          ? Math.min(100, safePct(revenue.ytd_closed_won, tierTarget))
          : 0.0,
      },
      deals,
      leads,
      mdf: { current_quarter: mdf },
      certifications: certs,
      tier_progress: tierProgress,
      recent_activity: recentActivity,
    };

    if (warnings.length > 0) {
      data.warnings = warnings;
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL MANAGER DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  async getChannelManagerDashboard(user: JwtPayload) {
    const orgIds = await dashboardRepository.getAssignedOrgIds(user.sub);

    const warnings: string[] = [];

    const results = await Promise.allSettled([
      dashboardRepository.getPortfolioSummary(orgIds),              // 0
      dashboardRepository.getPendingApprovals(user.sub),            // 1
      dashboardRepository.getPartnerPortfolio(orgIds),              // 2
      dashboardRepository.getLeadDistributionMetrics(orgIds),       // 3
      dashboardRepository.getRecentActivity(null, 10),              // 4 — CM sees global activity
    ]);

    const extract = <T>(index: number, section: string, fallback: T): T => {
      const r = results[index];
      if (r.status === 'fulfilled') return r.value as T;
      warnings.push(`Failed to load ${section}`);
      console.error(`Dashboard section '${section}' failed:`, r.reason);
      return fallback;
    };

    const summary = extract(0, 'summary', { total_partners: 0, active_partners: 0, total_pipeline_value: 0, total_ytd_revenue: 0, total_active_deals: 0 });
    const pendingApprovals = extract(1, 'pending_approvals', { total: 0, deals: 0, quotes: 0, mdf_requests: 0 });
    const rawPartners = extract<any[]>(2, 'partners', []);
    const leadMetrics = extract(3, 'lead_metrics', { total_unassigned: 0, total_assigned_pending: 0, avg_acceptance_hours: null, acceptance_rate_by_partner: [] });
    const recentActivity = extract(4, 'recent_activity', []);

    // Compute health scores for each partner
    // We need additional deal/lead data per partner for health score
    // Use the raw partner data + batch queries
    const partnerScored = await this.computePartnerHealthScores(rawPartners, orgIds);

    // Sort by health_score ascending (worst first)
    partnerScored.sort((a, b) => a.health_score - b.health_score);

    const data: any = {
      summary,
      pending_approvals: pendingApprovals,
      partners: partnerScored,
      lead_metrics: leadMetrics,
      recent_activity: recentActivity,
    };

    if (warnings.length > 0) {
      data.warnings = warnings;
    }

    return data;
  }

  private async computePartnerHealthScores(partners: any[], orgIds: string[]) {
    if (partners.length === 0) return [];

    // Batch queries for health score sub-metrics
    const dealStats = orgIds.length > 0
      ? await db_dealStats(orgIds)
      : [];
    const dealMap = new Map(dealStats.map((d: any) => [d.organization_id, d]));

    const leadStats = orgIds.length > 0
      ? await db_leadStats(orgIds)
      : [];
    const leadMap = new Map(leadStats.map((l: any) => [l.assigned_org_id, l]));

    const mdfStats = orgIds.length > 0
      ? await db_mdfStats(orgIds)
      : [];
    const mdfMap = new Map(mdfStats.map((m: any) => [m.organization_id, m]));

    return partners.map((p) => {
      const ds = dealMap.get(p.organization_id) || { won: 0, lost: 0 };
      const ls = leadMap.get(p.organization_id) || { total: 0, accepted: 0, avg_response_hours: null };
      const ms = mdfMap.get(p.organization_id) || { allocated: 0, spent: 0 };

      const healthInput = {
        ytd_revenue: p.ytd_revenue,
        min_annual_revenue: p.min_annual_revenue || 0,
        won_deals: parseInt(ds.won as string, 10) || 0,
        lost_deals: parseInt(ds.lost as string, 10) || 0,
        total_leads: parseInt(ls.total as string, 10) || 0,
        accepted_leads: parseInt(ls.accepted as string, 10) || 0,
        avg_response_hours: ls.avg_response_hours != null ? parseFloat(ls.avg_response_hours) : null,
        certified_reps: p.certified_reps,
        total_reps: p.total_reps,
        mdf_allocated: parseFloat(ms.allocated) || 0,
        mdf_spent: parseFloat(ms.spent) || 0,
      };

      const healthScore = computeHealthScore(healthInput);

      return {
        organization_id: p.organization_id,
        name: p.name,
        tier: p.tier,
        status: p.status,
        pipeline_value: p.pipeline_value,
        ytd_revenue: p.ytd_revenue,
        active_deals: p.active_deals,
        open_leads: p.open_leads,
        certified_reps: p.certified_reps,
        total_reps: p.total_reps,
        health_score: healthScore,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  async getAdminDashboard() {
    const warnings: string[] = [];

    const results = await Promise.allSettled([
      dashboardRepository.getProgramMetrics(),                      // 0
      dashboardRepository.getTierDistribution(),                    // 1
      dashboardRepository.getMdfUtilization(),                      // 2
      dashboardRepository.getCertCoverage(),                        // 3
      dashboardRepository.getTopPartners(10),                       // 4
      dashboardRepository.getPendingApprovals(),                    // 5 — admin: all pending
      dashboardRepository.getRecentActivity(null, 10),              // 6
    ]);

    const extract = <T>(index: number, section: string, fallback: T): T => {
      const r = results[index];
      if (r.status === 'fulfilled') return r.value as T;
      warnings.push(`Failed to load ${section}`);
      console.error(`Dashboard section '${section}' failed:`, r.reason);
      return fallback;
    };

    const programMetrics = extract(0, 'program_metrics', { total_partners: 0, active_partners: 0, total_pipeline_value: 0, total_ytd_revenue: 0, total_active_deals: 0, total_active_leads: 0, total_active_quotes: 0 });
    const tierDistribution = extract(1, 'tier_distribution', []);
    const mdfUtilization = extract(2, 'mdf_utilization', { total_allocated: 0, total_approved: 0, total_spent: 0, total_remaining: 0, utilization_pct: 0.0 });
    const certCoverage = extract(3, 'certification_coverage', { total_certified_users: 0, total_partner_users: 0, overall_pct: 0.0, by_tier: [] });
    const topPartners = extract(4, 'top_partners', { by_revenue: [], by_deal_count: [], by_lead_conversion: [] });
    const pendingApprovals = extract(5, 'pending_approvals', { total: 0, deals: 0, quotes: 0, mdf_requests: 0 });
    const recentActivity = extract(6, 'recent_activity', []);

    const data: any = {
      program_metrics: programMetrics,
      tier_distribution: tierDistribution,
      mdf_utilization: mdfUtilization,
      certification_coverage: certCoverage,
      top_partners: topPartners,
      pending_approvals: pendingApprovals,
      recent_activity: recentActivity,
    };

    if (warnings.length > 0) {
      data.warnings = warnings;
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  async getPipelineAnalytics(
    filters: { start_date?: string; end_date?: string; org_id?: string; product_id?: string; group_by?: string },
    scope: OrgScope,
  ) {
    const now = new Date();
    const startDate = filters.start_date || `${now.getFullYear()}-01-01`;
    const endDate = filters.end_date || now.toISOString().slice(0, 10);
    const orgIds = getOrgIdsFromScope(scope);

    // Validate org_id is within scope
    if (filters.org_id && orgIds !== null && !orgIds.includes(filters.org_id)) {
      throw AppError.forbidden('Organization not in your scope', 'AUTH_ORG_MISMATCH');
    }

    return dashboardRepository.getPipelineAnalytics({
      startDate,
      endDate,
      orgIds,
      orgId: filters.org_id,
      productId: filters.product_id,
      groupBy: filters.group_by || 'status',
    });
  }

  async getPartnerPerformanceAnalytics(
    filters: { org_id?: string; tier_id?: string; sort_by?: string; sort_order?: string; limit?: number; offset?: number },
    scope: OrgScope,
  ) {
    const orgIds = getOrgIdsFromScope(scope);

    if (filters.org_id && orgIds !== null && !orgIds.includes(filters.org_id)) {
      throw AppError.forbidden('Organization not in your scope', 'AUTH_ORG_MISMATCH');
    }

    const result = await dashboardRepository.getPartnerPerformanceData({
      orgIds,
      orgId: filters.org_id,
      tierId: filters.tier_id,
      limit: filters.limit || 25,
      offset: filters.offset || 0,
    });

    // Compute health scores for each partner
    const partnersWithHealth = result.partners.map((p: any) => {
      const m = p.metrics;
      // Compute accepted_leads: total_leads - leads not accepted (converted already accepted)
      // lead_conversion_rate = converted / total, so accepted >= converted
      // Use (total - converted * (1 - conversion_rate/100)) as rough proxy, but better: assume
      // all leads not disqualified/returned were accepted. Without raw counts, use total_leads - lost.
      // The most accurate proxy available: total_leads * sla_compliance as acceptance indicator.
      // Simplification: use total_leads as denominator and converted as acceptance floor.
      const acceptedLeads = m.total_leads_assigned > 0
        ? Math.max(m.leads_converted, Math.round(m.total_leads_assigned * (m.sla_compliance_pct / 100)))
        : 0;

      const healthInput = {
        ytd_revenue: m.ytd_revenue,
        min_annual_revenue: m.revenue_attainment_pct > 0 ? m.ytd_revenue / (m.revenue_attainment_pct / 100) : 0,
        won_deals: m.won_deals,
        lost_deals: m.lost_deals,
        total_leads: m.total_leads_assigned,
        accepted_leads: acceptedLeads,
        avg_response_hours: m.avg_lead_response_hours,
        certified_reps: m.certified_reps,
        total_reps: m.total_reps,
        mdf_allocated: m.mdf_allocated,
        mdf_spent: m.mdf_spent,
      };

      return {
        ...p,
        metrics: {
          ...m,
          health_score: computeHealthScore(healthInput),
        },
      };
    });

    // Sort
    const sortBy = filters.sort_by || 'revenue';
    const sortOrder = filters.sort_order || 'desc';
    const sortMap: Record<string, (p: any) => number | null> = {
      revenue: (p) => p.metrics.ytd_revenue,
      deal_count: (p) => p.metrics.total_deals,
      win_rate: (p) => p.metrics.win_rate,
      lead_conversion: (p) => p.metrics.lead_conversion_rate,
      health_score: (p) => p.metrics.health_score,
    };

    const sortFn = sortMap[sortBy] || sortMap.revenue;
    partnersWithHealth.sort((a, b) => {
      const va = sortFn(a);
      const vb = sortFn(b);
      // null values sort last
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortOrder === 'desc' ? vb - va : va - vb;
    });

    return {
      partners: partnersWithHealth,
      total: result.total,
    };
  }

  async getLeadConversionAnalytics(
    filters: { start_date?: string; end_date?: string; org_id?: string; source?: string },
    scope: OrgScope,
  ) {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const startDate = filters.start_date || ninetyDaysAgo.toISOString().slice(0, 10);
    const endDate = filters.end_date || now.toISOString().slice(0, 10);
    const orgIds = getOrgIdsFromScope(scope);

    if (filters.org_id && orgIds !== null && !orgIds.includes(filters.org_id)) {
      throw AppError.forbidden('Organization not in your scope', 'AUTH_ORG_MISMATCH');
    }

    return dashboardRepository.getLeadConversionAnalytics({
      startDate,
      endDate,
      orgIds,
      orgId: filters.org_id,
      source: filters.source,
    });
  }

  async getMdfRoiAnalytics(
    filters: { fiscal_year?: number; fiscal_quarter?: number; org_id?: string; activity_type?: string },
    scope: OrgScope,
  ) {
    const fiscalYear = filters.fiscal_year || new Date().getFullYear();
    const orgIds = getOrgIdsFromScope(scope);

    if (filters.org_id && orgIds !== null && !orgIds.includes(filters.org_id)) {
      throw AppError.forbidden('Organization not in your scope', 'AUTH_ORG_MISMATCH');
    }

    return dashboardRepository.getMdfRoiAnalytics({
      fiscalYear,
      fiscalQuarter: filters.fiscal_quarter,
      orgIds,
      orgId: filters.org_id,
      activityType: filters.activity_type,
    });
  }
}

// ─── Inline batch DB helpers for health score (avoid circular imports) ────────

import db from '../config/database';

async function db_dealStats(orgIds: string[]) {
  return db('deals')
    .whereIn('organization_id', orgIds)
    .groupBy('organization_id')
    .select(
      'organization_id',
      db.raw("COUNT(*) FILTER (WHERE status = 'won') as won"),
      db.raw("COUNT(*) FILTER (WHERE status = 'lost') as lost"),
    );
}

async function db_leadStats(orgIds: string[]) {
  return db('leads')
    .whereIn('assigned_org_id', orgIds)
    .whereIn('status', ['assigned', 'accepted', 'contacted', 'qualified', 'converted', 'returned', 'disqualified'])
    .groupBy('assigned_org_id')
    .select(
      'assigned_org_id',
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE status IN ('accepted','contacted','qualified','converted')) as accepted"),
      db.raw('AVG(CASE WHEN accepted_at IS NOT NULL AND assigned_at IS NOT NULL THEN EXTRACT(EPOCH FROM (accepted_at - assigned_at)) / 3600 END) as avg_response_hours'),
    );
}

async function db_mdfStats(orgIds: string[]) {
  const year = new Date().getFullYear();
  return db('mdf_allocations')
    .whereIn('organization_id', orgIds)
    .where('fiscal_year', year)
    .groupBy('organization_id')
    .select(
      'organization_id',
      db.raw('COALESCE(SUM(allocated_amount), 0) as allocated'),
      db.raw('COALESCE(SUM(spent_amount), 0) as spent'),
    );
}

export default new DashboardService();
