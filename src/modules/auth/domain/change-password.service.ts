import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { PASSWORD_PROVIDER, type PasswordProvider } from './ports/password.provider';
import { SecurityConfig } from '../config/security.config';
import { InvalidPasswordError, PasswordReuseError, UserNotFoundError } from './errors';

@Injectable()
export class ChangePasswordService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_PROVIDER)
    private readonly passwordProvider: PasswordProvider,
    private readonly securityConfig: SecurityConfig,
    @InjectPinoLogger(ChangePasswordService.name) private readonly logger: PinoLogger,
  ) {}

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const credentials = await this.userRepository.findActiveUserCredentialsById(userId);
    if (!credentials) {
      throw new UserNotFoundError();
    }

    const isCurrentPasswordValid = await this.passwordProvider.verify(
      currentPassword,
      credentials.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      this.logger.warn({ event: 'auth_change_password_invalid_current_password', userId });
      throw new InvalidPasswordError();
    }

    // Enforce reuse policy against the current password hash first (fast path).
    const isReused = await this.passwordProvider.verify(newPassword, credentials.passwordHash);
    if (isReused) {
      this.logger.warn({ event: 'auth_change_password_reuse_detected', userId });
      throw new PasswordReuseError();
    }

    // Check recent history hashes. If any match, reject with PasswordReuseError.
    const historyHashes = await this.userRepository.getRecentPasswordHashes(
      userId,
      this.securityConfig.maxPasswordHistorySize,
    );

    for (const historicalHash of historyHashes) {
      const matchesHistory = await this.passwordProvider.verify(newPassword, historicalHash);
      if (matchesHistory) {
        this.logger.warn({ event: 'auth_change_password_reuse_detected', userId });
        throw new PasswordReuseError();
      }
    }

    const nowIso = new Date().toISOString();
    const newPasswordHash = await this.passwordProvider.hash(newPassword);

    // The repository owns the transaction: it atomically archives the old hash to
    // password_history (pruning if needed), updates the user's password,
    // revokes all other sessions, and writes the outbox event.
    // All four operations share one pg_advisory_xact_lock.
    try {
      await this.userRepository.changePasswordAndRevokeOtherSessions({
        userId,
        passwordHash: newPasswordHash,
        currentSessionId,
        nowIso,
        previousPasswordHash: credentials.passwordHash,
        maxHistorySize: this.securityConfig.maxPasswordHistorySize,
        eventPayload: { eventType: 'password_changed', userId, timestamp: nowIso, ipAddress },
      });
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        this.logger.error({
          event: 'auth_change_password_atomic_operation_failed',
          userId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
      this.logger.error({
        event: 'auth_change_password_atomic_operation_failed',
        userId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    this.logger.info({ event: 'auth_password_changed', userId });

    return { message: 'Password changed successfully. All other sessions have been logged out.' };
  }
}
