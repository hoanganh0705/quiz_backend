import type { AuthIdentity } from '../../types/auth-context.types';

export interface UserRepositoryPort {
  findActiveByEmailWithPassword(email: string): Promise<{
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
    passwordHash: string;
    isVerified: boolean;
  } | null>;

  findActiveIdentityById(userId: string): Promise<{
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
  } | null>;

  createUser(
    email: string,
    username: string,
    passwordHash: string,
  ): Promise<{
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
    createdAt: string;
    isVerified: boolean;
  }>;

  ensureEmailAndUsernameAvailable(email: string, username: string): Promise<void>;

  setEmailVerificationToken(userId: string, tokenHash: string, expiresAtIso: string): Promise<void>;

  markEmailAsVerified(userId: string, nowIso: string): Promise<void>;

  findUserByActiveVerificationToken(
    tokenHash: string,
    nowIso: string,
  ): Promise<{ userId: string; email: string } | null>;

  findActiveVerificationStatusByEmail(
    email: string,
  ): Promise<{ userId: string; email: string; isVerified: boolean } | null>;

  getSecurityDashboard(userId: string): Promise<{
    emailVerified: boolean;
    lastPasswordChangedAt: string | null;
    lastLoginAt: string | null;
  } | null>;

  updatePasswordHash(userId: string, passwordHash: string, nowIso: string): Promise<void>;

  verifyPasswordHash(passwordHash: string, storedHash: string): Promise<boolean>;

  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: string): Promise<void>;

  findActivePasswordResetTokenByHash(
    tokenHash: string,
    nowIso: string,
  ): Promise<{ userId: string; email: string } | null>;

  markPasswordResetTokenUsed(tokenHash: string, nowIso: string): Promise<void>;

  revokeAllActivePasswordResetTokensForUser(userId: string, nowIso: string): Promise<void>;
}

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');
