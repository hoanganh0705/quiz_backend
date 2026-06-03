import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AuthConfig } from '../auth.config';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import { EMAIL_PROVIDER, type EmailProvider } from './ports/email.provider';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { SessionService } from './session.service';
import { InvalidTokenError } from './errors';
import { AUTH_SECURITY_EVENT_BUS, type AuthSecurityEventBusPort } from './events';

@Injectable()
export class PasswordResetService {
  private static readonly GENERIC_MESSAGE =
    'If the account exists, a password reset email has been sent.';

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
    private readonly authConfig: AuthConfig,
    @Inject(EMAIL_PROVIDER)
    private readonly emailService: EmailProvider,
    private readonly sessionService: SessionService,
    @Inject(AUTH_SECURITY_EVENT_BUS)
    private readonly eventBus: AuthSecurityEventBusPort,
    @InjectPinoLogger(PasswordResetService.name) private readonly logger: PinoLogger,
  ) {}

  private generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getResetExpiryIso(): string {
    return new Date(
      Date.now() + this.authConfig.passwordReset.tokenTtlSeconds * 1_000,
    ).toISOString();
  }

  async requestPasswordReset(email: string, ipAddress?: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findActiveVerificationStatusByEmail(normalizedEmail);

    if (!user) {
      this.logger.info({
        event: 'auth_password_reset_requested_unknown_email',
        email: normalizedEmail,
      });
      return { message: PasswordResetService.GENERIC_MESSAGE };
    }

    const token = this.generateResetToken();
    const tokenHash = this.cryptoService.hashSha256(token);
    const expiresAt = this.getResetExpiryIso();

    await this.userRepository.createPasswordResetToken(user.userId, tokenHash, expiresAt);

    this.eventBus.emitPasswordResetRequested({
      eventType: 'password_reset_requested',
      userId: user.userId,
      email: normalizedEmail,
      timestamp: new Date(),
      ipAddress,
    });

    try {
      await this.emailService.enqueuePasswordResetEmail(normalizedEmail, token, user.userId);
    } catch (error) {
      this.logger.error({
        event: 'auth_password_reset_email_enqueue_failed',
        userId: user.userId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return { message: PasswordResetService.GENERIC_MESSAGE };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.cryptoService.hashSha256(token);
    const nowIso = new Date().toISOString();

    const tokenData = await this.userRepository.findActivePasswordResetTokenByHash(
      tokenHash,
      nowIso,
    );

    if (!tokenData) {
      this.logger.warn({
        event: 'auth_password_reset_invalid_token',
      });
      throw new InvalidTokenError('Invalid or expired password reset token');
    }

    const { userId, email } = tokenData;
    const passwordHash = await this.cryptoService.hashBcrypt(newPassword);

    await this.userRepository.updatePasswordHash(userId, passwordHash, nowIso);
    await this.userRepository.markPasswordResetTokenUsed(tokenHash, nowIso);
    await this.sessionService.revokeAllActiveSessions(userId);

    this.eventBus.emitPasswordResetCompleted({
      eventType: 'password_reset_completed',
      userId,
      email,
      timestamp: new Date(),
      ipAddress,
    });

    this.logger.info({
      event: 'auth_password_reset_completed',
      userId,
    });

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  async consumePasswordResetToken(token: string): Promise<{ userId: string } | null> {
    const tokenHash = this.cryptoService.hashSha256(token);
    const nowIso = new Date().toISOString();
    return this.userRepository.findActivePasswordResetTokenByHash(tokenHash, nowIso);
  }
}
