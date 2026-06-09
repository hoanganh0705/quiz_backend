export type LoginCommand = {
  email: string;
  password: string;
};

export type RegisterCommand = {
  username: string;
  email: string;
  password: string;
};

export type VerifyEmailCommand = {
  token: string;
};

export type ResendVerificationEmailCommand = {
  email: string;
};

export type ForgotPasswordCommand = {
  email: string;
};

export type ResetPasswordCommand = {
  token: string;
  newPassword: string;
};

export type ChangePasswordCommand = {
  userId: string;
  currentPassword: string;
  newPassword: string;
};
