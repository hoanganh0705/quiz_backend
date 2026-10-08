import {
  DEFAULT_BULLMQ_JOB_OPTIONS,
  DEFAULT_REMOVAL_POLICY,
  DEFAULT_RETRY_POLICY,
} from './bullmq.config';

describe('bullmq.config (shared producer defaults)', () => {
  it('exports a retry policy with sensible exponential defaults', () => {
    expect(DEFAULT_RETRY_POLICY.attempts).toBe(5);
    expect(DEFAULT_RETRY_POLICY.backoff).toEqual({ type: 'exponential', delay: 5_000 });
  });

  it('exports a removal policy that bounds completed and failed jobs', () => {
    expect(DEFAULT_REMOVAL_POLICY.removeOnComplete).toEqual({ age: 86_400, count: 1_000 });
    expect(DEFAULT_REMOVAL_POLICY.removeOnFail).toEqual({ age: 604_800, count: 5_000 });
  });

  it('merges retry and removal into a single JobsOptions payload', () => {
    expect(DEFAULT_BULLMQ_JOB_OPTIONS.attempts).toBe(DEFAULT_RETRY_POLICY.attempts);
    expect(DEFAULT_BULLMQ_JOB_OPTIONS.backoff).toEqual(DEFAULT_RETRY_POLICY.backoff);
    expect(DEFAULT_BULLMQ_JOB_OPTIONS.removeOnComplete).toEqual(
      DEFAULT_REMOVAL_POLICY.removeOnComplete,
    );
    expect(DEFAULT_BULLMQ_JOB_OPTIONS.removeOnFail).toEqual(DEFAULT_REMOVAL_POLICY.removeOnFail);
  });
});
