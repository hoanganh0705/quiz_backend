import type { UserRole } from '@/common/types/user-role.type';

export type AuthIdentity = {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
};

export type AuthIdentityLike = {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
};

export function toAuthIdentity(user: AuthIdentityLike): AuthIdentity {
  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenJti: string;
};

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
};

export type AccessTokenClaims = {
  sub: string;
  role: UserRole;
  sessionId?: string;
};

export type RefreshTokenClaims = {
  sub: string;
  jti: string;
};

export type RefreshTokenPayload = RefreshTokenClaims & {
  iss: string;
  aud: string | string[];
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
