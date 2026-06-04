import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { SessionService } from './session.service';
import { AUTH_SECURITY_EVENT_BUS, type AuthSecurityEventPublisherPort } from './events';
import type { AccountDeletionResult } from '../types/auth-result.types';

@Injectable()
export class AccountDeletionService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    private readonly sessionService: SessionService,
    @Inject(AUTH_SECURITY_EVENT_BUS)
    private readonly eventBus: AuthSecurityEventPublisherPort,
    @InjectPinoLogger(AccountDeletionService.name) private readonly logger: PinoLogger,
  ) {}

  async deleteAccount(
    userId: string,
    email: string,
    ipAddress?: string,
  ): Promise<AccountDeletionResult> {
    const nowIso = new Date().toISOString();

    await this.userRepository.softDeleteUser(userId, nowIso);
    await this.sessionService.revokeAllActiveSessions(userId);

    this.eventBus.publishAccountDeleted({
      eventType: 'account_deleted',
      userId,
      email,
      timestamp: new Date(),
      ipAddress,
    });

    this.logger.info({ event: 'auth_account_deleted', userId });

    return { message: 'Account deleted successfully. All sessions have been terminated.' };
  }
}
