import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { PASSWORD_PROVIDER, type PasswordProvider } from './ports/password.provider';
import { InvalidCredentialsError, DeletionFailedError } from './errors';
import type { AccountDeletionResult } from '../types/auth-result.types';

@Injectable()
export class AccountDeletionService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_PROVIDER)
    private readonly passwordProvider: PasswordProvider,
    @InjectPinoLogger(AccountDeletionService.name) private readonly logger: PinoLogger,
  ) {}

  async deleteAccountWithCredentialVerification(
    userId: string,
    password: string,
    ipAddress?: string,
  ): Promise<AccountDeletionResult> {
    const credentials = await this.userRepository.findActiveUserCredentialsById(userId);
    if (!credentials) {
      throw new InvalidCredentialsError();
    }

    const valid = await this.passwordProvider.verify(password, credentials.passwordHash);
    if (!valid) {
      this.logger.warn({ event: 'auth_account_deletion_invalid_password', userId });
      throw new InvalidCredentialsError();
    }

    const nowIso = new Date().toISOString();

    try {
      // The repository atomically: soft-deletes the user, revokes all sessions,
      // and writes the account_deleted outbox event — all in one transaction.
      await this.userRepository.deleteAccountAndRevokeSessions({
        userId,
        nowIso,
        eventPayload: { eventType: 'account_deleted', userId, timestamp: nowIso, ipAddress },
      });
    } catch (error) {
      if (error instanceof DeletionFailedError) {
        this.logger.warn({ event: 'auth_account_deletion_failed', userId });
        throw new InvalidCredentialsError();
      }
      this.logger.error({
        event: 'auth_account_deletion_atomic_operation_failed',
        userId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    this.logger.info({ event: 'auth_account_deleted', userId });

    return { message: 'Account deleted successfully. All sessions have been terminated.' };
  }
}
