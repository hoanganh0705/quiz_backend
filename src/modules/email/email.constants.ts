export const EMAIL_QUEUE_NAME = 'email';

// Using Symbols for DI tokens to ensure uniqueness and avoid potential naming collisions
export const EMAIL_QUEUE_TOKENS = {
  CONNECTION: Symbol('EMAIL_QUEUE_CONNECTION'),
  QUEUE: Symbol('EMAIL_QUEUE'),
} as const;

export const EMAIL_JOB_NAMES = {
  SEND_VERIFICATION_EMAIL: 'sendVerificationEmail',
  SEND_PASSWORD_RESET_EMAIL: 'sendPasswordResetEmail',
} as const;
