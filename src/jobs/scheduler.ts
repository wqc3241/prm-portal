import cron, { ScheduledTask } from 'node-cron';
import { processDealExpirations } from './dealExpiration.job';
import { processDealExpirationReminders } from './dealExpirationReminder.job';
import { processLeadSlaChecks } from './leadSlaCheck.job';
import { processCertExpiryNotifications } from './certExpiry.job';
import { processMdfClaimDeadlines } from './mdfClaimDeadline.job';
import { processMdfQuarterlyAllocations } from './mdfQuarterlyAllocation.job';
import { processTierRecalculation } from './tierRecalculation.job';
import { processMetricsRollup } from './metricsRollup.job';
import { processInactiveDealReminders } from './inactiveDealReminder.job';

interface ScheduledJob {
  name: string;
  schedule: string;
  handler: () => Promise<any>;
  task?: ScheduledTask;
}

const jobs: ScheduledJob[] = [
  {
    name: 'metricsRollup',
    schedule: '0 0 * * *',           // daily midnight
    handler: processMetricsRollup,
  },
  {
    name: 'tierRecalculation',
    schedule: '0 2 * * *',           // daily 2 AM
    handler: processTierRecalculation,
  },
  {
    name: 'dealExpiration',
    schedule: '0 6 * * *',           // daily 6 AM
    handler: processDealExpirations,
  },
  {
    name: 'dealExpirationReminder',
    schedule: '0 7 * * *',           // daily 7 AM
    handler: processDealExpirationReminders,
  },
  {
    name: 'leadSlaCheck',
    schedule: '0 */4 * * *',         // every 4 hours
    handler: processLeadSlaChecks,
  },
  {
    name: 'certExpiry',
    schedule: '0 8 * * *',           // daily 8 AM
    handler: processCertExpiryNotifications,
  },
  {
    name: 'mdfClaimDeadline',
    schedule: '0 9 * * *',           // daily 9 AM
    handler: processMdfClaimDeadlines,
  },
  {
    name: 'mdfQuarterlyAllocation',
    schedule: '0 0 1 1,4,7,10 *',   // quarterly: 1st of Jan, Apr, Jul, Oct
    handler: processMdfQuarterlyAllocations,
  },
  {
    name: 'inactiveDealReminder',
    schedule: '0 9 * * 1',           // Monday 9 AM
    handler: processInactiveDealReminders,
  },
];

/**
 * Wraps a job handler with start/end logging and error catching.
 */
function wrapHandler(job: ScheduledJob): () => void {
  return async () => {
    const start = Date.now();
    console.log(`[Scheduler] Starting job: ${job.name}`);

    try {
      const result = await job.handler();
      const durationMs = Date.now() - start;
      console.log(`[Scheduler] Job ${job.name} completed in ${durationMs}ms. Result:`, JSON.stringify(result));
    } catch (err) {
      const durationMs = Date.now() - start;
      console.error(`[Scheduler] Job ${job.name} failed after ${durationMs}ms:`, err);
    }
  };
}

/**
 * Start all scheduled cron jobs. Call once after the server is ready.
 */
export function startScheduler(): void {
  console.log('[Scheduler] Registering scheduled jobs...');

  for (const job of jobs) {
    if (!cron.validate(job.schedule)) {
      console.error(`[Scheduler] Invalid cron expression for ${job.name}: "${job.schedule}". Skipping.`);
      continue;
    }

    job.task = cron.schedule(job.schedule, wrapHandler(job), {
      scheduled: true,
      timezone: 'UTC',
    });

    console.log(`[Scheduler]   ${job.name} → ${job.schedule}`);
  }

  console.log(`[Scheduler] ${jobs.filter((j) => j.task).length} jobs scheduled.`);
}

/**
 * Stop all scheduled cron jobs. Call during graceful shutdown.
 */
export function stopScheduler(): void {
  console.log('[Scheduler] Stopping all scheduled jobs...');

  for (const job of jobs) {
    if (job.task) {
      job.task.stop();
      job.task = undefined;
    }
  }

  console.log('[Scheduler] All jobs stopped.');
}
