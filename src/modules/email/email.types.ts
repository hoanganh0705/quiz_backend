export type EmailJobDataBase = {
  email: string;
  token: string;
  userId?: string;
  correlationId?: string;
};

export type SendVerificationEmailJobData = EmailJobDataBase & {
  userId?: string;
};

export type SendPasswordResetEmailJobData = EmailJobDataBase & {
  userId: string;
};
