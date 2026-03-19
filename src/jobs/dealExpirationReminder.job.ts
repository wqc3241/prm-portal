import dealRepository from '../repositories/deal.repository';
import notificationService from '../services/notification.service';

/**
 * Deal Expiration Reminder Job
 *
 * Sends 14-day and 7-day reminder notifications to partners
 * whose approved deals are approaching expiration.
 *
 * Schedule: Daily at 7:00 AM UTC (cron: '0 7 * * *')
 * Idempotent: Checks for existing reminder notifications before creating new ones.
 */
export async function processDealExpirationReminders(): Promise<{
  fourteenDay: number;
  sevenDay: number;
  errors: number;
}> {
  let fourteenDayCount = 0;
  let sevenDayCount = 0;
  let errorCount = 0;

  // ─── 14-day reminders ────────────────────────────────────────────
  try {
    const fourteenDayDeals = await dealRepository.findExpiringInWindow(13, 15);

    for (const deal of fourteenDayDeals) {
      try {
        // Check if 14-day reminder already sent (idempotency)
        const alreadySent = await notificationService.reminderExists(
          'deal',
          deal.id,
          'expires in 14 days',
        );

        if (alreadySent) continue;

        await notificationService.createNotification({
          user_id: deal.submitted_by,
          type: 'deal_update',
          title: `Deal ${deal.deal_number} expires in 14 days`,
          body: `Your deal registration protection will expire on ${new Date(deal.registration_expires_at).toISOString().slice(0, 10)}. Please close the deal or request an extension.`,
          entity_type: 'deal',
          entity_id: deal.id,
          action_url: `/deals/${deal.id}`,
        });

        fourteenDayCount++;
      } catch (err) {
        errorCount++;
        console.error(`Reminder job: failed to send 14-day reminder for deal ${deal.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Reminder job: failed to query 14-day expiring deals:', err);
    errorCount++;
  }

  // ─── 7-day reminders ─────────────────────────────────────────────
  try {
    const sevenDayDeals = await dealRepository.findExpiringInWindow(6, 8);

    for (const deal of sevenDayDeals) {
      try {
        // Check if 7-day reminder already sent (idempotency)
        const alreadySent = await notificationService.reminderExists(
          'deal',
          deal.id,
          'expires in 7 days',
        );

        if (alreadySent) continue;

        await notificationService.createNotification({
          user_id: deal.submitted_by,
          type: 'deal_update',
          title: `Deal ${deal.deal_number} expires in 7 days`,
          body: `URGENT: Your deal registration protection will expire on ${new Date(deal.registration_expires_at).toISOString().slice(0, 10)}. Please close the deal soon.`,
          entity_type: 'deal',
          entity_id: deal.id,
          action_url: `/deals/${deal.id}`,
        });

        sevenDayCount++;
      } catch (err) {
        errorCount++;
        console.error(`Reminder job: failed to send 7-day reminder for deal ${deal.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Reminder job: failed to query 7-day expiring deals:', err);
    errorCount++;
  }

  console.log(
    `Reminder job completed. Sent ${fourteenDayCount} 14-day and ${sevenDayCount} 7-day reminders. Errors: ${errorCount}.`,
  );

  return { fourteenDay: fourteenDayCount, sevenDay: sevenDayCount, errors: errorCount };
}
