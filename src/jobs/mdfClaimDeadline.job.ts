import mdfRepository from '../repositories/mdf.repository';
import notificationService from '../services/notification.service';
import { MDF_CLAIM_DEADLINE_DAYS, MDF_CLAIM_WARNING_DAYS } from '../config/constants';

/**
 * MDF Claim Deadline Warning Job
 *
 * Sends notifications to partners whose approved/completed MDF requests
 * are approaching the 60-day claim deadline (end_date + 60 days).
 *
 * Schedule: Daily at 9:00 AM UTC (cron: '0 9 * * *')
 * Idempotent: Checks for existing reminder notifications before creating new ones.
 *
 * Warning intervals: 45, 30, 14, 7 days before deadline (from MDF_CLAIM_WARNING_DAYS).
 * Also sends a "deadline TODAY" and "deadline PASSED" notification.
 */
export async function processMdfClaimDeadlines(): Promise<{
  warningsSent: number;
  errors: number;
}> {
  let warningsSent = 0;
  let errorCount = 0;

  try {
    const requests = await mdfRepository.findRequestsForClaimDeadline();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const request of requests) {
      try {
        const endDate = new Date(request.end_date);
        const deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + MDF_CLAIM_DEADLINE_DAYS);
        deadline.setHours(0, 0, 0, 0);

        const diffMs = deadline.getTime() - today.getTime();
        const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

        // Check if we should send a warning for this day count
        if (MDF_CLAIM_WARNING_DAYS.includes(daysRemaining)) {
          const dedupKey = `claim deadline in ${daysRemaining} days`;
          const alreadySent = await notificationService.reminderExists(
            'mdf_request',
            request.id,
            dedupKey,
          );
          if (alreadySent) continue;

          await notificationService.createNotification({
            user_id: request.submitted_by,
            type: 'mdf_update',
            title: `MDF claim deadline in ${daysRemaining} days: ${request.request_number}`,
            body: `Submit your claim for ${request.request_number} by ${deadline.toISOString().slice(0, 10)}. Upload proof of execution to receive reimbursement.`,
            entity_type: 'mdf_request',
            entity_id: request.id,
            action_url: `/mdf/requests/${request.id}`,
          });
          warningsSent++;
        } else if (daysRemaining === 0) {
          const dedupKey = 'claim deadline is TODAY';
          const alreadySent = await notificationService.reminderExists(
            'mdf_request',
            request.id,
            dedupKey,
          );
          if (alreadySent) continue;

          await notificationService.createNotification({
            user_id: request.submitted_by,
            type: 'mdf_update',
            title: `MDF claim deadline is TODAY for ${request.request_number}`,
            body: `Today is the last day to submit your claim for ${request.request_number}. Upload proof of execution now.`,
            entity_type: 'mdf_request',
            entity_id: request.id,
            action_url: `/mdf/requests/${request.id}`,
          });
          warningsSent++;
        } else if (daysRemaining < 0 && request.status === 'approved') {
          // Approved but never completed, and deadline has passed
          const dedupKey = 'claim deadline PASSED';
          const alreadySent = await notificationService.reminderExists(
            'mdf_request',
            request.id,
            dedupKey,
          );
          if (alreadySent) continue;

          await notificationService.createNotification({
            user_id: request.submitted_by,
            type: 'mdf_update',
            title: `MDF claim deadline PASSED for ${request.request_number}`,
            body: `The 60-day claim window has closed for ${request.request_number}. Contact your admin if you need assistance.`,
            entity_type: 'mdf_request',
            entity_id: request.id,
            action_url: `/mdf/requests/${request.id}`,
          });
          warningsSent++;
        }
      } catch (err) {
        errorCount++;
        console.error(`MDF claim deadline job: failed to process request ${request.id}:`, err);
      }
    }
  } catch (err) {
    console.error('MDF claim deadline job: failed to query requests:', err);
    errorCount++;
  }

  console.log(
    `MDF claim deadline job completed. Sent ${warningsSent} warnings. Errors: ${errorCount}.`,
  );

  return { warningsSent, errors: errorCount };
}
