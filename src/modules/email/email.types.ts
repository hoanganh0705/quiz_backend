export type SendVerificationEmailJobData = {
  email: string;
  token: string;
  userId?: string;
};

export type SendPasswordResetEmailJobData = {
  email: string;
  token: string;
  userId: string;
};
