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
};

export type RefreshTokenResult = {
  accessToken: string;
  refreshToken: string;
};
