import { UserRole } from '@/modules/auth/decorators/roles.decorator';

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

export type AuthIdentity = {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenJti: string;
};

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  iss: string;
  aud: string;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  iss: string;
  aud: string;
  exp?: number;
  iat?: number;
};

export type SessionDeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

export type SessionRequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  deviceBrowser: string | null;
  deviceOs: string | null;
  deviceType: SessionDeviceType;
};
