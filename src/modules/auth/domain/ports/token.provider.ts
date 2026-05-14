import type { AuthIdentity, AuthTokens, RefreshTokenPayload } from '../../types/auth-context.types';

export interface TokenProvider {
  issueTokens(identity: AuthIdentity): Promise<AuthTokens>;
  verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload>;
  tryVerifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload | null>;
}

export const TOKEN_PROVIDER = Symbol('TOKEN_PROVIDER');
