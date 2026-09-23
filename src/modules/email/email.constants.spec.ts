import {
  EMAIL_QUEUE_NAME,
  EMAIL_QUEUE_TOKENS,
  EMAIL_JOB_NAMES,
  EMAIL_JOB_RETRY_POLICY,
  EMAIL_DEFAULT_BASE_URLS,
} from './email.constants';

describe('email.constants', () => {
  it('exports the email queue name', () => {
    expect(EMAIL_QUEUE_NAME).toBe('email');
  });

  it('exports Symbol-based DI tokens', () => {
    expect(typeof EMAIL_QUEUE_TOKENS.CONNECTION).toBe('symbol');
    expect(typeof EMAIL_QUEUE_TOKENS.QUEUE).toBe('symbol');
    expect(EMAIL_QUEUE_TOKENS.CONNECTION).not.toBe(EMAIL_QUEUE_TOKENS.QUEUE);
  });

  it('exports the job-name registry', () => {
    expect(EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL).toBe('sendVerificationEmail');
    expect(EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL).toBe('sendPasswordResetEmail');
  });

  it('exposes a frozen retry policy with sensible defaults', () => {
    expect(Object.isFrozen(EMAIL_JOB_RETRY_POLICY)).toBe(true);
    expect(EMAIL_JOB_RETRY_POLICY.attempts).toBe(5);
    expect(EMAIL_JOB_RETRY_POLICY.backoff).toEqual({ type: 'exponential', delay: 5_000 });
    expect(EMAIL_JOB_RETRY_POLICY.removeOnComplete).toEqual({ age: 86_400, count: 1_000 });
    expect(EMAIL_JOB_RETRY_POLICY.removeOnFail).toEqual({ age: 604_800, count: 5_000 });
  });

  it('exposes frozen default base URLs', () => {
    expect(Object.isFrozen(EMAIL_DEFAULT_BASE_URLS)).toBe(true);
    expect(EMAIL_DEFAULT_BASE_URLS.VERIFICATION).toMatch(/^http/);
    expect(EMAIL_DEFAULT_BASE_URLS.PASSWORD_RESET).toMatch(/^http/);
  });
});
