export const EMAIL_QUEUE_NAME = 'email';

export const EMAIL_QUEUE_TOKENS = {
  CONNECTION: Symbol('EMAIL_QUEUE_CONNECTION'),
  QUEUE: Symbol('EMAIL_QUEUE'),
} as const;

export const EMAIL_JOB_NAMES = {
  SEND_VERIFICATION_EMAIL: 'sendVerificationEmail',
} as const;
