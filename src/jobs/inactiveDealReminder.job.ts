import db from '../config/database';
import notificationService from '../services/notification.service';

/**
 * Inactive Deal Reminder Job
 *
 * Sends weekly reminders to deal owners whose deals have had no activity
 * for 14+ days and are still in an active status (draft, submitted, approved).
 *
 * Schedule: Weekly on Monday at 9:00 AM UTC (cron: '0 9 * * 1')
 * Idempotent: Checks for existing reminder notification within the past 7 days
 *   using reminderExists() to avoid duplicate reminders.
 */

const INACTIVE_DAYS = 14;

export async function processInactiveDealReminders(): Promise<{
  reminders_sent: number;
  errors: number;
}> {
  let remindersSent = 0;
  let errorCount = 0;

  try {
    // Find deals that are still active but haven't been updated in 14+ days
    const inactiveDeals = await db('deals')
      .select('id', 'deal_number', 'deal_name', 'submitted_by', 'updated_at')
      .whereIn('status', ['draft', 'submitted', 'approved'])
      .whereRaw('updated_at < NOW() - ?::interval', [`${INACTIVE_DAYS} days`]);

    console.log(`[InactiveDealReminder] Found ${inactiveDeals.length} inactive deals (>= ${INACTIVE_DAYS} days).`);

    for (const deal of inactiveDeals) {
      try {
        // Calculate days since last activity
        const now = new Date();
        const lastUpdate = new Date(deal.updated_at);
        const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

        // Deduplicate: check if reminder was already sent this week
        const alreadySent = await notificationService.reminderExists(
          'deal',
          deal.id,
          'has had no activity for',
          7, // only check within last 7 days (weekly reminder)
        );

        if (alreadySent) continue;

        await notificationService.createNotification({
          user_id: deal.submitted_by,
          type: 'deal_update',
          title: `Deal ${deal.deal_number} has had no activity for ${daysSince} days`,
          body: `Your deal "${deal.deal_name || deal.deal_number}" has not been updated in ${daysSince} days. Please review and update its status.`,
          entity_type: 'deal',
          entity_id: deal.id,
          action_url: `/deals/${deal.id}`,
        });

        remindersSent++;
      } catch (err) {
        errorCount++;
        console.error(`[InactiveDealReminder] Failed to send reminder for deal ${deal.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[InactiveDealReminder] Failed to query inactive deals:', err);
    errorCount++;
  }

  console.log(
    `[InactiveDealReminder] Completed. Reminders sent: ${remindersSent}. Errors: ${errorCount}.`,
  );

  return { reminders_sent: remindersSent, errors: errorCount };
}
