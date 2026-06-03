export interface EmailProvider {
  enqueueVerificationEmail(email: string, token: string, userId?: string): Promise<void>;
  enqueuePasswordResetEmail(email: string, token: string, userId: string): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
