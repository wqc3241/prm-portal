import db from '../config/database';
import notificationService from '../services/notification.service';
import { SYSTEM_USER_EMAIL } from '../config/constants';

/**
 * Tier Recalculation Job
 *
 * For every active organization, compares current performance metrics
 * against tier requirements. Upgrades are applied immediately; downgrades
 * are subject to a 30-day grace period.
 *
 * Schedule: Daily at 2:00 AM UTC (cron: '0 2 * * *')
 * Idempotent: Uses optimistic WHERE tier_id = :currentTierId guard.
 */

const GRACE_PERIOD_DAYS = 30;

export async function processTierRecalculation(): Promise<{
  upgraded: number;
  downgraded: number;
  grace_warnings: number;
  errors: number;
}> {
  let upgraded = 0;
  let downgraded = 0;
  let graceWarnings = 0;
  let errorCount = 0;

  // Resolve system user
  let systemUserId: string | undefined;
  const systemUser = await db('users')
    .select('id')
    .where('email', SYSTEM_USER_EMAIL)
    .first();
  systemUserId = systemUser?.id;

  if (!systemUserId) {
    const admin = await db('users')
      .select('id')
      .where('role', 'admin')
      .where('is_active', true)
      .first();
    systemUserId = admin?.id;
  }

  if (!systemUserId) {
    console.error('[TierRecalc] No system or admin user found. Aborting.');
    return { upgraded: 0, downgraded: 0, grace_warnings: 0, errors: 0 };
  }

  // Load all tiers ordered by rank ascending (lowest first)
  const tiers = await db('partner_tiers').orderBy('rank', 'asc');
  if (tiers.length === 0) {
    console.log('[TierRecalc] No tiers configured. Nothing to do.');
    return { upgraded: 0, downgraded: 0, grace_warnings: 0, errors: 0 };
  }

  // Build a map for quick lookups
  const tierMap = new Map<string, any>();
  for (const tier of tiers) {
    tierMap.set(tier.id, tier);
  }

  // Get all active organizations with their current tier info
  const orgs = await db('organizations')
    .select('id', 'name', 'tier_id', 'ytd_revenue', 'ytd_deals_closed',
      'certified_rep_count', 'tier_downgrade_grace_at')
    .where('status', 'active');

  console.log(`[TierRecalc] Evaluating ${orgs.length} active organizations against ${tiers.length} tiers.`);

  for (const org of orgs) {
    try {
      const currentTier = org.tier_id ? tierMap.get(org.tier_id) : null;
      const currentRank = currentTier?.rank ?? 0;

      // Determine the highest tier this org qualifies for
      let qualifiedTier: any = tiers[0]; // fallback to lowest tier
      for (const tier of tiers) {
        const meetsRevenue = parseFloat(org.ytd_revenue || '0') >= parseFloat(tier.min_annual_revenue || '0');
        const meetsDeals = (org.ytd_deals_closed || 0) >= (tier.min_deals_closed || 0);
        const meetsCerts = (org.certified_rep_count || 0) >= (tier.min_certified_reps || 0);

        if (meetsRevenue && meetsDeals && meetsCerts) {
          qualifiedTier = tier;
        } else {
          // Tiers are ordered ascending — once we fail a tier, stop
          break;
        }
      }

      const qualifiedRank = qualifiedTier.rank;

      if (qualifiedRank > currentRank) {
        // ─── Upgrade: apply immediately ────────────────────────────
        const updated = await db('organizations')
          .where('id', org.id)
          .where('tier_id', org.tier_id) // optimistic guard
          .update({
            tier_id: qualifiedTier.id,
            tier_downgrade_grace_at: null, // clear any pending grace
            updated_at: db.fn.now(),
          });

        if (updated === 0) continue; // concurrent change, skip

        // Notify partner_admins
        const admins = await db('users')
          .select('id')
          .where('organization_id', org.id)
          .where('role', 'partner_admin')
          .where('is_active', true);

        for (const admin of admins) {
          await notificationService.createNotification({
            user_id: admin.id,
            type: 'tier_change',
            title: `Tier upgrade: ${currentTier?.name || 'None'} → ${qualifiedTier.name}`,
            body: `Congratulations! ${org.name} has been upgraded to ${qualifiedTier.name} tier based on your performance metrics.`,
            entity_type: 'organization',
            entity_id: org.id,
            action_url: '/dashboard',
          });
        }

        // Also notify channel manager if assigned
        const cmOrg = await db('organizations').select('channel_manager_id').where('id', org.id).first();
        if (cmOrg?.channel_manager_id) {
          await notificationService.createNotification({
            user_id: cmOrg.channel_manager_id,
            type: 'tier_change',
            title: `${org.name} upgraded to ${qualifiedTier.name}`,
            body: `Partner ${org.name} has been upgraded from ${currentTier?.name || 'None'} to ${qualifiedTier.name}.`,
            entity_type: 'organization',
            entity_id: org.id,
            action_url: `/organizations/${org.id}`,
          });
        }

        upgraded++;
        console.log(`[TierRecalc] Upgraded ${org.name}: ${currentTier?.name || 'None'} → ${qualifiedTier.name}`);

      } else if (qualifiedRank < currentRank) {
        // ─── Potential downgrade: check grace period ───────────────
        const now = new Date();

        if (!org.tier_downgrade_grace_at) {
          // Start grace period
          const graceDeadline = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

          await db('organizations')
            .where('id', org.id)
            .update({
              tier_downgrade_grace_at: graceDeadline.toISOString(),
              updated_at: db.fn.now(),
            });

          // Warn partner admins
          const admins = await db('users')
            .select('id')
            .where('organization_id', org.id)
            .where('role', 'partner_admin')
            .where('is_active', true);

          for (const admin of admins) {
            await notificationService.createNotification({
              user_id: admin.id,
              type: 'tier_change',
              title: `Tier downgrade warning: ${currentTier?.name} at risk`,
              body: `${org.name} no longer meets ${currentTier?.name} tier requirements. You have ${GRACE_PERIOD_DAYS} days to meet the criteria or be downgraded to ${qualifiedTier.name}.`,
              entity_type: 'organization',
              entity_id: org.id,
              action_url: '/dashboard',
            });
          }

          graceWarnings++;
          console.log(`[TierRecalc] Grace period started for ${org.name}: ${GRACE_PERIOD_DAYS} days to maintain ${currentTier?.name}`);

        } else {
          // Grace period already started — check if it has elapsed
          const graceDeadline = new Date(org.tier_downgrade_grace_at);

          if (now >= graceDeadline) {
            // Grace expired — downgrade
            const updated = await db('organizations')
              .where('id', org.id)
              .where('tier_id', org.tier_id)
              .update({
                tier_id: qualifiedTier.id,
                tier_downgrade_grace_at: null,
                updated_at: db.fn.now(),
              });

            if (updated === 0) continue;

            // Notify partner admins
            const admins = await db('users')
              .select('id')
              .where('organization_id', org.id)
              .where('role', 'partner_admin')
              .where('is_active', true);

            for (const admin of admins) {
              await notificationService.createNotification({
                user_id: admin.id,
                type: 'tier_change',
                title: `Tier downgrade: ${currentTier?.name} → ${qualifiedTier.name}`,
                body: `${org.name} has been downgraded to ${qualifiedTier.name}. The grace period has elapsed without meeting ${currentTier?.name} tier requirements.`,
                entity_type: 'organization',
                entity_id: org.id,
                action_url: '/dashboard',
              });
            }

            const cmOrg = await db('organizations').select('channel_manager_id').where('id', org.id).first();
            if (cmOrg?.channel_manager_id) {
              await notificationService.createNotification({
                user_id: cmOrg.channel_manager_id,
                type: 'tier_change',
                title: `${org.name} downgraded to ${qualifiedTier.name}`,
                body: `Partner ${org.name} has been downgraded from ${currentTier?.name} to ${qualifiedTier.name} after grace period expiry.`,
                entity_type: 'organization',
                entity_id: org.id,
                action_url: `/organizations/${org.id}`,
              });
            }

            downgraded++;
            console.log(`[TierRecalc] Downgraded ${org.name}: ${currentTier?.name} → ${qualifiedTier.name} (grace period expired)`);
          } else {
            // Still within grace period — log warning
            const daysRemaining = Math.ceil((graceDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            graceWarnings++;
            console.log(`[TierRecalc] ${org.name} still in grace period: ${daysRemaining} days remaining for ${currentTier?.name}`);
          }
        }

      } else {
        // Org qualifies for current tier — clear any grace if it was set
        if (org.tier_downgrade_grace_at) {
          await db('organizations')
            .where('id', org.id)
            .update({
              tier_downgrade_grace_at: null,
              updated_at: db.fn.now(),
            });
          console.log(`[TierRecalc] ${org.name} now meets ${currentTier?.name} requirements again — grace period cleared.`);
        }
      }
    } catch (err) {
      errorCount++;
      console.error(`[TierRecalc] Failed to evaluate org ${org.id} (${org.name}):`, err);
    }
  }

  console.log(
    `[TierRecalc] Completed. Upgraded: ${upgraded}. Downgraded: ${downgraded}. ` +
    `Grace warnings: ${graceWarnings}. Errors: ${errorCount}.`,
  );

  return { upgraded, downgraded, grace_warnings: graceWarnings, errors: errorCount };
}
