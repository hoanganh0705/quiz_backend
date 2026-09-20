import { Injectable } from '@nestjs/common';
import type { UserRepositoryPort } from '@/modules/auth/domain/ports/user-repository.port';
import { UserIdentityRepository } from './aggregates/user-identity.repository';
import { UserRegistrationRepository } from './aggregates/user-registration.repository';
import { EmailVerificationRepository } from './aggregates/email-verification.repository';
import { PasswordResetTokensRepository } from './aggregates/password-reset-tokens.repository';
import { PasswordChangeRepository } from './aggregates/password-change.repository';
import { AccountLifecycleRepository } from './aggregates/account-lifecycle.repository';

/**
 * Thin façade over the auth sub-repositories.
 * Every method delegates to the appropriate collaborator — no domain logic lives here.
 */
@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(
    private readonly identity: UserIdentityRepository,
    private readonly registration: UserRegistrationRepository,
    private readonly emailVerification: EmailVerificationRepository,
    private readonly passwordReset: PasswordResetTokensRepository,
    private readonly passwordChange: PasswordChangeRepository,
    private readonly accountLifecycle: AccountLifecycleRepository,
  ) {}

  async findActiveIdentityByEmail(email: string) {
    return this.identity.findActiveIdentityByEmail(email);
  }

  async findActiveUserProfile(userId: string) {
    return this.identity.findActiveUserProfile(userId);
  }

  async findActiveUserCredentialsById(userId: string) {
    return this.identity.findActiveUserCredentialsById(userId);
  }

  async findActiveByEmailWithPassword(email: string) {
    return this.identity.findActiveByEmailWithPassword(email);
  }

  async findActiveIdentityById(userId: string) {
    return this.identity.findActiveIdentityById(userId);
  }

  async findMeById(userId: string) {
    return this.identity.findMeById(userId);
  }

  async isEmailAvailable(email: string) {
    return this.identity.isEmailAvailable(email);
  }

  async isUsernameAvailable(username: string) {
    return this.identity.isUsernameAvailable(username);
  }

  async getSecurityMetadata(userId: string) {
    return this.identity.getSecurityMetadata(userId);
  }

  async createUser(email: string, username: string, passwordHash: string) {
    return this.registration.createUser(email, username, passwordHash);
  }

  async createUserWithPasswordHistory(params: {
    email: string;
    username: string;
    passwordHash: string;
    nowIso: string;
  }) {
    return this.registration.createUserWithPasswordHistory(params);
  }

  async setEmailVerificationToken(userId: string, tokenHash: string, expiresAtIso: string) {
    return this.emailVerification.setEmailVerificationToken(userId, tokenHash, expiresAtIso);
  }

  async findActiveVerificationStatusByEmail(email: string) {
    return this.emailVerification.findActiveVerificationStatusByEmail(email);
  }

  async findUserByActiveVerificationToken(tokenHash: string, nowIso: string) {
    return this.emailVerification.findUserByActiveVerificationToken(tokenHash, nowIso);
  }

  async markEmailAsVerified(userId: string, nowIso: string) {
    return this.emailVerification.markEmailAsVerified(userId, nowIso);
  }

  async getRecentPasswordHashes(userId: string, count: number) {
    return this.passwordChange.getRecentPasswordHashes(userId, count);
  }

  async changePasswordAndRevokeOtherSessions(params: {
    userId: string;
    passwordHash: string;
    currentSessionId: string;
    nowIso: string;
    previousPasswordHash: string | null;
    maxHistorySize: number;
    eventPayload?: Record<string, unknown>;
  }) {
    return this.passwordChange.changePasswordAndRevokeOtherSessions(params);
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: string) {
    return this.passwordReset.createPasswordResetToken(userId, tokenHash, expiresAt);
  }

  async findActivePasswordResetTokenByHash(tokenHash: string, nowIso: string) {
    return this.passwordReset.findActivePasswordResetTokenByHash(tokenHash, nowIso);
  }

  async revokeAllActivePasswordResetTokensForUser(userId: string, nowIso: string) {
    return this.passwordReset.revokeAllActivePasswordResetTokensForUser(userId, nowIso);
  }

  async consumePasswordResetTokenAndResetPassword(params: {
    tokenHash: string;
    passwordHash: string;
    nowIso: string;
    eventPayload?: Record<string, unknown>;
  }) {
    return this.passwordReset.consumePasswordResetTokenAndResetPassword(params);
  }

  async deleteAccountAndRevokeSessions(params: {
    userId: string;
    nowIso: string;
    eventPayload?: Record<string, unknown>;
  }) {
    return this.accountLifecycle.deleteAccountAndRevokeSessions(params);
  }
}
