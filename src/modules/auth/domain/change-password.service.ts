import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { PASSWORD_PROVIDER, type PasswordProvider } from './ports/password.provider';
import { SessionService } from './session.service';
import { InvalidPasswordError } from './errors';
import { AUTH_SECURITY_EVENT_BUS, type AuthSecurityEventPublisherPort } from './events';

@Injectable()
export class ChangePasswordService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_PROVIDER)
    private readonly passwordProvider: PasswordProvider,
    private readonly sessionService: SessionService,
    @Inject(AUTH_SECURITY_EVENT_BUS)
    private readonly eventBus: AuthSecurityEventPublisherPort,
    @InjectPinoLogger(ChangePasswordService.name) private readonly logger: PinoLogger,
  ) {}

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const identity = await this.userRepository.findActiveIdentityById(userId);
    if (!identity) {
      throw new InvalidPasswordError();
    }

    const userWithPassword = await this.userRepository.findActiveByEmailWithPassword(
      identity.email,
    );
    if (!userWithPassword) {
      throw new InvalidPasswordError();
    }

    const isCurrentPasswordValid = await this.passwordProvider.verify(
      currentPassword,
      userWithPassword.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      this.logger.warn({
        event: 'auth_change_password_invalid_current_password',
        userId,
      });
      throw new InvalidPasswordError();
    }

    const nowIso = new Date().toISOString();
    const newPasswordHash = await this.passwordProvider.hash(newPassword);

    await this.userRepository.updatePasswordHash(userId, newPasswordHash, nowIso);
    await this.sessionService.revokeOtherActiveSessions(userId, currentSessionId);

    this.eventBus.publishPasswordChanged({
      eventType: 'password_changed',
      userId,
      email: identity.email,
      timestamp: new Date(),
      ipAddress,
    });

    this.logger.info({
      event: 'auth_password_changed',
      userId,
    });

    return { message: 'Password changed successfully. All other sessions have been logged out.' };
  }
}
