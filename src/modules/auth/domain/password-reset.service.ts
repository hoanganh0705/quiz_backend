import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PasswordResetConfig } from '../config/password-reset-token.config';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import { PASSWORD_PROVIDER, type PasswordProvider } from './ports/password.provider';
import { EMAIL_PROVIDER, type EmailProvider } from './ports/email.provider';
import { AUTH_USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { normalizeEmail } from './utils/normalization.utils';
import { InvalidTokenError } from './errors';

const PASSWORD_RESET_SUCCESS_MESSAGE =
  'Password has been reset successfully. Please log in with your new password.';

@Injectable()
export class PasswordResetService {
  private static readonly GENERIC_MESSAGE =
    'If the account exists, a password reset email has been sent.';

  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
    @Inject(PASSWORD_PROVIDER)
    private readonly passwordProvider: PasswordProvider,
    private readonly passwordResetConfig: PasswordResetConfig,
    @Inject(EMAIL_PROVIDER)
    private readonly emailService: EmailProvider,
    @InjectPinoLogger(PasswordResetService.name) private readonly logger: PinoLogger,
  ) {}

  private generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getResetExpiryIso(): string {
    return new Date(Date.now() + this.passwordResetConfig.tokenTtlSeconds * 1_000).toISOString();
  }

  async requestPasswordReset(email: string, ipAddress?: string): Promise<{ message: string }> {
    const normalizedEmail = normalizeEmail(email);
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

    this.logger.info({
      event: 'auth_security_password_reset_requested',
      eventType: 'password_reset_requested',
      userId: user.userId,
      timestamp: new Date().toISOString(),
      ipAddress,
    });

    this.logger.info({
      event: 'auth_password_reset_requested',
      userId: user.userId,
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

    // Idempotency guard: check token state before spending CPU on bcrypt.
    // If the token was already consumed, fail fast without hashing the password.
    const existing = await this.userRepository.findActivePasswordResetTokenByHash(
      tokenHash,
      nowIso,
    );
    if (!existing) {
      this.logger.warn({ event: 'auth_password_reset_idempotent_replay' });
      throw new InvalidTokenError('Invalid or expired password reset token');
    }

    let userId: string;
    try {
      const passwordHash = await this.passwordProvider.hash(newPassword);

      const result = await this.userRepository.consumePasswordResetTokenAndResetPassword({
        tokenHash,
        passwordHash,
        nowIso,
        eventPayload: {
          eventType: 'password_reset_completed',
          userId: existing.userId,
          timestamp: nowIso,
          ipAddress,
        },
      });
      userId = result.userId;
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        // Token was consumed between the pre-check and the atomic call — safe to replay.
        this.logger.warn({ event: 'auth_password_reset_concurrent_consumption' });
        throw error;
      }
      this.logger.error({
        event: 'auth_password_reset_atomic_operation_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    this.logger.info({ event: 'auth_password_reset_completed', userId });

    return {
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    };
  }
}
