import Bull, { Queue, JobOptions } from 'bull';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Default job options applied to every queue unless overridden.
 *
 * - attempts: 3 retries with exponential backoff (2s base)
 * - removeOnComplete: keep last 100 completed jobs for debugging
 * - removeOnFail: keep last 50 failed jobs for post-mortem
 */
const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 50,
};

/** Registry of all queues so we can close them on shutdown. */
const queues: Queue[] = [];

/**
 * Create (or reuse) a Bull queue with standard Redis connection,
 * default job options, and event logging.
 */
export function createQueue<T = any>(name: string, overrides?: JobOptions): Queue<T> {
  const queue = new Bull<T>(name, redisUrl, {
    defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...overrides },
  });

  // ─── Event logging ────────────────────────────────────────────────
  queue.on('completed', (job) => {
    console.log(`[Queue:${name}] Job ${job.id} completed.`);
  });

  queue.on('failed', (job, err) => {
    console.error(`[Queue:${name}] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}):`, err.message);
  });

  queue.on('stalled', (job) => {
    console.warn(`[Queue:${name}] Job ${job.id} stalled — will be reprocessed.`);
  });

  queue.on('error', (err) => {
    console.error(`[Queue:${name}] Queue error:`, err.message);
  });

  queues.push(queue);
  return queue;
}

/**
 * Close every queue created by createQueue(). Called during graceful shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  for (const q of queues) {
    try {
      await q.close();
    } catch (err: any) {
      console.error(`[Queue] Error closing queue ${q.name}:`, err.message);
    }
  }
  queues.length = 0;
}
