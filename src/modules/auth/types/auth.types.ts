import { UserRole } from '../../../common/decorators/roles.decorator';

export type RegisterResult = {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
  accessToken: string;
  refreshToken: string;
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

export type AuthIdentity = {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshTokenPayload = {
  sub: string;
  type?: string;
};
