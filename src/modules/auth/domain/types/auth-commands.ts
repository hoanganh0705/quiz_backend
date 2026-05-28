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
