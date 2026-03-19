import dealRepository from '../repositories/deal.repository';
import notificationService from '../services/notification.service';
import db from '../config/database';
import { SYSTEM_USER_EMAIL } from '../config/constants';

/**
 * Deal Expiration Job
 *
 * Finds all approved deals whose registration_expires_at has passed
 * and transitions them to 'expired'. Creates notifications for the
 * submitter and the org's channel manager.
 *
 * Schedule: Daily at 6:00 AM UTC (cron: '0 6 * * *')
 * Idempotent: Uses WHERE status = 'approved' guard to prevent re-processing.
 */
export async function processDealExpirations(): Promise<{ expired: number; errors: number }> {
  let expiredCount = 0;
  let errorCount = 0;

  // Get system user ID
  const systemUser = await db('users')
    .select('id')
    .where('email', SYSTEM_USER_EMAIL)
    .first();

  const systemUserId = systemUser?.id;
  if (!systemUserId) {
    console.error('Deal expiration job: system user not found. Create a user with email:', SYSTEM_USER_EMAIL);
    // Fall back to any admin
    const admin = await db('users').select('id').where('role', 'admin').where('is_active', true).first();
    if (!admin) {
      console.error('Deal expiration job: no admin user found. Aborting.');
      return { expired: 0, errors: 0 };
    }
  }

  const changedBy = systemUserId || (await db('users').select('id').where('role', 'admin').first())?.id;
  if (!changedBy) {
    console.error('Deal expiration job: no user available for changed_by. Aborting.');
    return { expired: 0, errors: 0 };
  }

  const expiredDeals = await dealRepository.findExpired();

  console.log(`Deal expiration job: found ${expiredDeals.length} deals to expire.`);

  for (const deal of expiredDeals) {
    try {
      // Optimistic concurrency: only update if still approved
      const updated = await dealRepository.updateStatus(deal.id, 'approved', 'expired');

      if (!updated) {
        // Deal was already transitioned (e.g., marked won between query and update)
        continue;
      }

      // Insert status history
      await dealRepository.insertStatusHistory({
        deal_id: deal.id,
        from_status: 'approved',
        to_status: 'expired',
        changed_by: changedBy,
        notes: 'Auto-expired: protection window elapsed',
      });

      // Notify submitter (NT-8)
      await notificationService.createNotification({
        user_id: deal.submitted_by,
        type: 'deal_update',
        title: `Deal ${deal.deal_number} has expired`,
        body: 'Your deal registration protection window has elapsed. You may register a new deal if the opportunity is still active.',
        entity_type: 'deal',
        entity_id: deal.id,
        action_url: `/deals/${deal.id}`,
      });

      // Notify CM (NT-8)
      const org = await db('organizations')
        .select('channel_manager_id')
        .where('id', deal.organization_id)
        .first();

      if (org?.channel_manager_id) {
        await notificationService.createNotification({
          user_id: org.channel_manager_id,
          type: 'deal_update',
          title: `Deal ${deal.deal_number} has expired`,
          body: 'A deal registration protection window has elapsed.',
          entity_type: 'deal',
          entity_id: deal.id,
          action_url: `/deals/${deal.id}`,
        });
      }

      expiredCount++;
    } catch (err) {
      errorCount++;
      console.error(`Deal expiration job: failed to expire deal ${deal.id}:`, err);
      // Continue processing other deals
    }
  }

  console.log(`Deal expiration job completed. Expired ${expiredCount} deals. Errors: ${errorCount}.`);
  return { expired: expiredCount, errors: errorCount };
}
