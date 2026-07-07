import type { AuthIdentity } from '../../types/auth-context.types';

export interface UserRepositoryPort {
  /**
   * Finds an active user by email for OAuth linking decisions.
   * Returns only identity fields needed for the OAuth login flow.
   */
  findActiveIdentityByEmail(email: string): Promise<{
    userId: string;
    username: string;
    email: string;
    isVerified: boolean;
    role: AuthIdentity['role'];
  } | null>;

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

  findActiveUserProfile(userId: string): Promise<{
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
    isVerified: boolean;
  } | null>;

  findActiveUserCredentialsById(userId: string): Promise<{
    userId: string;
    email: string;
    passwordHash: string;
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

  setEmailVerificationToken(userId: string, tokenHash: string, expiresAtIso: string): Promise<void>;

  markEmailAsVerified(userId: string, nowIso: string): Promise<void>;

  findUserByActiveVerificationToken(
    tokenHash: string,
    nowIso: string,
  ): Promise<{ userId: string; email: string } | null>;

  findActiveVerificationStatusByEmail(
    email: string,
  ): Promise<{ userId: string; email: string; isVerified: boolean } | null>;

  isEmailAvailable(email: string): Promise<boolean>;

  isUsernameAvailable(username: string): Promise<boolean>;

  getSecurityMetadata(userId: string): Promise<{
    emailVerified: boolean;
    lastPasswordChangedAt: string | null;
    lastLoginAt: string | null;
    activeSessionCount: number;
  } | null>;

  /**
   * Returns the most recent `count` password hashes for the given user,
   * ordered newest-first. Used by ChangePasswordService to enforce the
   * password reuse policy before accepting a new password.
   */
  getRecentPasswordHashes(userId: string, count: number): Promise<string[]>;

  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: string): Promise<void>;

  findActivePasswordResetTokenByHash(
    tokenHash: string,
    nowIso: string,
  ): Promise<{ userId: string; passwordResetTokenId: string } | null>;

  revokeAllActivePasswordResetTokensForUser(userId: string, nowIso: string): Promise<void>;

  /**
   * Atomically consumes a password-reset token, updates the user's password hash,
   * and revokes all active sessions. If the token is invalid, expired, or already
   * consumed, throws InvalidTokenError. All three operations succeed or rollback
   * together — no partial state is possible.
   *
   * An outbox event for `password_reset_completed` is persisted in the same
   * transaction so it cannot be lost if the process crashes after commit.
   *
   * @throws {InvalidTokenError} token not found, expired, already used, or user deleted
   */
  consumePasswordResetTokenAndResetPassword(params: {
    tokenHash: string;
    passwordHash: string;
    nowIso: string;
    eventPayload?: Record<string, unknown>;
  }): Promise<{ userId: string }>;

  /**
   * Atomically soft-deletes a user and revokes all their active sessions.
   * Both operations succeed or rollback together.
   *
   * An outbox event for `account_deleted` is persisted in the same transaction
   * so it cannot be lost if the process crashes after commit.
   *
   * @throws {DeletionFailedError} user not found or already deleted
   */
  deleteAccountAndRevokeSessions(params: {
    userId: string;
    nowIso: string;
    eventPayload?: Record<string, unknown>;
  }): Promise<void>;

  /**
   * Atomically updates a user's password hash, archives the previous hash to
   * password history (pruning old entries), and revokes all sessions except
   * the current one. All four operations succeed or rollback together.
   *
   * The repository holds a pg_advisory_xact_lock(hashtext(userId)) for the
   * duration of the transaction, serializing this flow against any concurrent
   * change-password, reset-password, or account-deletion for the same user.
   *
   * An outbox event for `password_changed` is persisted in the same transaction
   * so it cannot be lost if the process crashes after commit.
   *
   * @param previousPasswordHash - the user's current password hash to archive
   *   before updating. Pass null to skip history archival (e.g., accounts
   *   created before history was enabled).
   * @param maxHistorySize - how many historical hashes to retain per user;
   *   the adapter prunes oldest entries when the cap is exceeded.
   *
   * @throws {UserNotFoundError} user not found or already deleted
   */
  changePasswordAndRevokeOtherSessions(params: {
    userId: string;
    passwordHash: string;
    currentSessionId: string;
    nowIso: string;
    previousPasswordHash: string | null;
    maxHistorySize: number;
    eventPayload?: Record<string, unknown>;
  }): Promise<void>;
}
export const AUTH_USER_REPOSITORY_PORT = Symbol('AUTH_USER_REPOSITORY_PORT');
