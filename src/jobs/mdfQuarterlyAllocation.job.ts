import mdfService from '../services/mdf.service';
import notificationService from '../services/notification.service';
import db from '../config/database';

/**
 * MDF Quarterly Auto-Allocation Job
 *
 * Calculates and creates MDF allocations for all eligible partner organizations
 * based on tier rules, trailing revenue, and top-performer bonuses.
 *
 * Schedule: 1st of each quarter at 1:00 AM UTC (cron: '0 1 1 1,4,7,10 *')
 * Reuses mdfService.autoAllocate() which is also exposed via the manual API endpoint.
 */
export async function processMdfQuarterlyAllocations(): Promise<{
  created: number;
  skipped_existing: number;
  skipped_no_revenue: number;
  skipped_no_mdf_tier: number;
  errors: number;
}> {
  let errorCount = 0;

  try {
    // Determine current fiscal quarter
    const { year, quarter } = getCurrentFiscalQuarter();

    console.log(`MDF quarterly allocation: generating allocations for Q${quarter} ${year}...`);

    // Run auto-allocation
    const result = await mdfService.autoAllocate(year, quarter);

    console.log(
      `MDF quarterly allocation complete. Created: ${result.created}, ` +
      `Skipped existing: ${result.skipped_existing}, ` +
      `Skipped no revenue: ${result.skipped_no_revenue}, ` +
      `Skipped no MDF tier: ${result.skipped_no_mdf_tier}.`,
    );

    // Notify all active admin users
    try {
      const adminUsers = await db('users')
        .select('id')
        .where('role', 'admin')
        .where('is_active', true);

      for (const admin of adminUsers) {
        await notificationService.createNotification({
          user_id: admin.id,
          type: 'system_announcement',
          title: `Q${quarter} ${year} MDF allocations generated`,
          body: `${result.created} allocations created, ${result.skipped_existing} skipped (existing), ${result.skipped_no_revenue} skipped (no revenue).`,
        });
      }
    } catch (err) {
      console.error('MDF quarterly allocation: failed to notify admins:', err);
      errorCount++;
    }

    return {
      created: result.created,
      skipped_existing: result.skipped_existing,
      skipped_no_revenue: result.skipped_no_revenue,
      skipped_no_mdf_tier: result.skipped_no_mdf_tier,
      errors: errorCount,
    };
  } catch (err) {
    console.error('MDF quarterly allocation: job failed:', err);
    return {
      created: 0,
      skipped_existing: 0,
      skipped_no_revenue: 0,
      skipped_no_mdf_tier: 0,
      errors: 1,
    };
  }
}

/**
 * Determine the current fiscal quarter based on today's date.
 * Assumes calendar-year fiscal quarters: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec.
 */
function getCurrentFiscalQuarter(): { year: number; quarter: number } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 11=Dec
  const quarter = Math.floor(month / 3) + 1;
  return { year: now.getFullYear(), quarter };
}
