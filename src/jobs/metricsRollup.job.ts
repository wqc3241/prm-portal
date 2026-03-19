import db from '../config/database';

/**
 * Metrics Rollup Job
 *
 * Recalculates denormalized performance metrics for every active organization:
 *   - ytd_revenue: SUM(deals.actual_value) for won deals in current year
 *   - ytd_deals_closed: COUNT of won deals in current year
 *   - active_deals_count: COUNT of in-progress deals
 *   - certified_rep_count: COUNT DISTINCT users with valid certifications
 *   - total_pipeline_value: SUM(deals.estimated_value) for open deals
 *
 * Schedule: Daily at midnight UTC (cron: '0 0 * * *')
 * Idempotent: Pure recalculation from source-of-truth tables. Safe to re-run.
 */
export async function processMetricsRollup(): Promise<{
  updated: number;
  errors: number;
}> {
  let updatedCount = 0;
  let errorCount = 0;

  const currentYear = new Date().getFullYear();

  // Get all active orgs
  const orgs = await db('organizations')
    .select('id', 'name')
    .where('status', 'active');

  console.log(`[MetricsRollup] Rolling up metrics for ${orgs.length} active organizations (year=${currentYear}).`);

  for (const org of orgs) {
    try {
      // ─── YTD Revenue: SUM actual_value of won deals this year ──────
      const [revenueResult] = await db('deals')
        .where('organization_id', org.id)
        .where('status', 'won')
        .whereNotNull('actual_close_date')
        .whereRaw('EXTRACT(YEAR FROM actual_close_date) = ?', [currentYear])
        .select(
          db.raw('COALESCE(SUM(actual_value), 0)::numeric as ytd_revenue'),
          db.raw('COUNT(*)::int as ytd_deals_closed'),
        ) as any as { ytd_revenue: string; ytd_deals_closed: number }[];

      // ─── Active deals count ────────────────────────────────────────
      const [activeResult] = await db('deals')
        .where('organization_id', org.id)
        .whereIn('status', ['submitted', 'approved', 'under_review'])
        .select(db.raw('COUNT(*)::int as active_deals_count')) as any as { active_deals_count: number }[];

      // ─── Certified rep count ───────────────────────────────────────
      const [certResult] = await db('user_certifications as uc')
        .join('users as u', 'uc.user_id', 'u.id')
        .where('u.organization_id', org.id)
        .where('u.is_active', true)
        .where('uc.status', 'passed')
        .where('uc.expires_at', '>', db.fn.now())
        .select(db.raw('COUNT(DISTINCT uc.user_id)::int as certified_rep_count')) as any as { certified_rep_count: number }[];

      // ─── Total pipeline value ──────────────────────────────────────
      const [pipelineResult] = await db('deals')
        .where('organization_id', org.id)
        .whereNotIn('status', ['won', 'lost', 'expired', 'rejected'])
        .select(db.raw('COALESCE(SUM(estimated_value), 0)::numeric as total_pipeline_value')) as any as { total_pipeline_value: string }[];

      // ─── Update org ────────────────────────────────────────────────
      await db('organizations')
        .where('id', org.id)
        .update({
          ytd_revenue: parseFloat(revenueResult.ytd_revenue),
          ytd_deals_closed: revenueResult.ytd_deals_closed,
          active_deals_count: activeResult.active_deals_count,
          certified_rep_count: certResult.certified_rep_count,
          total_pipeline_value: parseFloat(pipelineResult.total_pipeline_value),
          updated_at: db.fn.now(),
        });

      updatedCount++;
    } catch (err) {
      errorCount++;
      console.error(`[MetricsRollup] Failed to roll up metrics for org ${org.id} (${org.name}):`, err);
    }
  }

  console.log(
    `[MetricsRollup] Completed. Updated: ${updatedCount}. Errors: ${errorCount}.`,
  );

  return { updated: updatedCount, errors: errorCount };
}
