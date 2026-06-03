export type RegisterResult = {
  message: string;
};

export type VerifyEmailResult = {
  message: string;
};

export type LoginResult = {
  userId: string;
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export type RefreshTokenResult = {
  accessToken: string;
  refreshToken: string;
};

export type ForgotPasswordResult = {
  message: string;
};

export type ResetPasswordResult = {
  message: string;
};

export type ChangePasswordResult = {
  message: string;
};

export type SessionManagementResult = {
  message: string;
};

export type AccountSecurityResult = {
  emailVerified: boolean;
  activeSessionCount: number;
  lastSuccessfulLoginAt: string | null;
  lastPasswordChangeAt: string | null;
};
