import courseRepository from '../repositories/course.repository';
import notificationService from '../services/notification.service';
import { CERT_WARNING_DAYS } from '../config/constants';

/**
 * Certification Expiry Job
 *
 * 1. Send warning notifications at 30, 7, 1 day marks to certified users
 *    and their org's partner_admins.
 * 2. Auto-update status to 'expired' when expires_at < NOW().
 * 3. Recalculate certified_rep_count for affected orgs.
 *
 * Schedule: Daily at 8:00 AM UTC (cron: '0 8 * * *')
 * Idempotent: Checks for existing reminder notifications before creating new ones.
 */
export async function processCertExpiryNotifications(): Promise<{
  notified_30d: number;
  notified_7d: number;
  notified_1d: number;
  expired: number;
  recalculated_orgs: number;
  errors: number;
}> {
  const results = {
    notified_30d: 0,
    notified_7d: 0,
    notified_1d: 0,
    expired: 0,
    recalculated_orgs: 0,
    errors: 0,
  };

  // ─── Step 1: Send warning notifications ─────────────────────────
  for (const window of CERT_WARNING_DAYS) {
    try {
      // Find certs expiring within this window
      // Use a range: > (window-1) days and <= window days from now
      const minDays = window === 1 ? 0 : window - 1;
      const maxDays = window;
      const certs = await courseRepository.findCertsExpiringInWindow(minDays, maxDays);

      for (const cert of certs) {
        try {
          // Deduplicate: check if we already sent this warning
          const alreadySent = await notificationService.reminderExists(
            'certification',
            cert.id,
            `expires in ${window} day`,
          );

          if (alreadySent) continue;

          const expiresDate = new Date(cert.expires_at).toISOString().slice(0, 10);

          // Notify the certified user
          await notificationService.createNotification({
            user_id: cert.user_id,
            type: 'certification_expiring',
            title: `${cert.course_name} certification expires in ${window} day${window === 1 ? '' : 's'}`,
            body: `Your ${cert.course_name} certification expires on ${expiresDate}. Re-enroll to maintain your certification.`,
            entity_type: 'certification',
            entity_id: cert.id,
            action_url: '/training/certifications',
          });

          // Also notify partner_admins of the user's org
          if (cert.organization_id) {
            const admins = await courseRepository.getPartnerAdminsForOrg(cert.organization_id);
            for (const admin of admins) {
              try {
                await notificationService.createNotification({
                  user_id: admin.id,
                  type: 'certification_expiring',
                  title: `${cert.user_email} ${cert.course_name} certification expires in ${window} day${window === 1 ? '' : 's'}`,
                  body: `${cert.user_email}'s ${cert.course_name} certification expires on ${expiresDate}.`,
                  entity_type: 'certification',
                  entity_id: cert.id,
                  action_url: '/training/org-certifications',
                });
              } catch (err) {
                console.error(`[CertExpiry] Failed to notify admin ${admin.id}:`, (err as Error).message);
                results.errors++;
              }
            }
          }

          const key = `notified_${window}d` as keyof typeof results;
          (results as any)[key]++;
        } catch (err) {
          results.errors++;
          console.error(`[CertExpiry] Failed to process cert ${cert.id}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.error(`[CertExpiry] Failed to query ${window}-day expiring certs:`, (err as Error).message);
      results.errors++;
    }
  }

  // ─── Step 2: Auto-expire passed certs past expires_at ────────────
  try {
    const expiredCount = await courseRepository.updateExpiredCerts();
    results.expired = expiredCount;
  } catch (err) {
    console.error('[CertExpiry] Failed to expire certs:', (err as Error).message);
    results.errors++;
  }

  // ─── Step 3: Recalculate certified_rep_count for affected orgs ───
  try {
    const affectedOrgs = await courseRepository.getAffectedOrgIds();
    for (const row of affectedOrgs) {
      try {
        await courseRepository.recalcCertifiedRepCount(row.org_id);
        results.recalculated_orgs++;
      } catch (err) {
        console.error(`[CertExpiry] Failed to recalc org ${row.org_id}:`, (err as Error).message);
        results.errors++;
      }
    }
  } catch (err) {
    console.error('[CertExpiry] Failed to get affected orgs:', (err as Error).message);
    results.errors++;
  }

  console.log(
    `[CertExpiry] Completed. ` +
    `Notified: 30d=${results.notified_30d}, 7d=${results.notified_7d}, 1d=${results.notified_1d}. ` +
    `Expired: ${results.expired}. Recalculated: ${results.recalculated_orgs} orgs. ` +
    `Errors: ${results.errors}.`,
  );

  return results;
}
