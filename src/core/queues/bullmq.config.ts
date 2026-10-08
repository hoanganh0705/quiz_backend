import type { JobsOptions } from 'bullmq';

/**
 * Shared BullMQ producer configuration.
 *
 * Email and tournament event producers both enqueue jobs to dedicated
 * Redis-backed queues; the defaults below define the standard retry,
 * backoff, and removal policies applied to every job. Centralising them
 * keeps the two producers in lock-step so an operator sees consistent
 * retry behaviour across the system and can tune a single knob.
 *
 * Tuning notes:
 *   - `attempts` caps total retries including the initial attempt.
 *   - `removeOnComplete.count` keeps the completed list bounded for the
 *     cheapest Redis memory footprint; historical jobs stay in Redis until
 *     `age` seconds pass.
 *   - `removeOnFail` is intentionally more generous so post-mortem
 *     investigation has time to read failed jobs.
 */
export const DEFAULT_RETRY_POLICY: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
};

export const DEFAULT_REMOVAL_POLICY: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> = {
  removeOnComplete: {
    age: 86_400,
    count: 1_000,
  },
  removeOnFail: {
    age: 604_800,
    count: 5_000,
  },
};

/**
 * Merge the shared retry policy with the shared removal policy into a
 * single `JobsOptions` object ready for `Queue.add(...)`.
 */
export const DEFAULT_BULLMQ_JOB_OPTIONS: JobsOptions = {
  ...DEFAULT_RETRY_POLICY,
  ...DEFAULT_REMOVAL_POLICY,
};
