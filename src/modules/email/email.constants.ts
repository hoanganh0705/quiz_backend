export const EMAIL_QUEUE_NAME = 'email';

export const EMAIL_QUEUE_TOKENS = {
  CONNECTION: Symbol('EMAIL_QUEUE_CONNECTION'),
  QUEUE: Symbol('EMAIL_QUEUE'),
  RESEND_CLIENT: Symbol('EMAIL_RESEND_CLIENT'),
} as const;

export const EMAIL_JOB_NAMES = {
  SEND_VERIFICATION_EMAIL: 'sendVerificationEmail',
  SEND_PASSWORD_RESET_EMAIL: 'sendPasswordResetEmail',
} as const;

export const EMAIL_DEFAULT_BASE_URLS = Object.freeze({
  VERIFICATION: 'http://localhost:3000/verify-email',
  PASSWORD_RESET: 'http://localhost:3000/reset-password',
} as const);
