export const EMAIL_QUEUE_NAME = 'email';

export const EMAIL_QUEUE_TOKENS = {
  CONNECTION: Symbol('EMAIL_QUEUE_CONNECTION'),
  QUEUE: Symbol('EMAIL_QUEUE'),
} as const;

export const EMAIL_JOB_NAMES = {
  SEND_VERIFICATION_EMAIL: 'sendVerificationEmail',
  SEND_PASSWORD_RESET_EMAIL: 'sendPasswordResetEmail',
} as const;

export const EMAIL_JOB_RETRY_POLICY = Object.freeze({
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: {
    age: 86_400,
    count: 1_000,
  },
  removeOnFail: {
    age: 604_800,
    count: 5_000,
  },
} as const);

export const EMAIL_DEFAULT_BASE_URLS = Object.freeze({
  VERIFICATION: 'http://localhost:3000/verify-email',
  PASSWORD_RESET: 'http://localhost:3000/reset-password',
} as const);
