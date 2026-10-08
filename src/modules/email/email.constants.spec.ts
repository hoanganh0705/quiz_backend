import {
  EMAIL_QUEUE_NAME,
  EMAIL_QUEUE_TOKENS,
  EMAIL_JOB_NAMES,
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

  it('exposes frozen default base URLs', () => {
    expect(Object.isFrozen(EMAIL_DEFAULT_BASE_URLS)).toBe(true);
    expect(EMAIL_DEFAULT_BASE_URLS.VERIFICATION).toMatch(/^http/);
    expect(EMAIL_DEFAULT_BASE_URLS.PASSWORD_RESET).toMatch(/^http/);
  });
});
