import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  RegisterCommand,
  ResendVerificationEmailCommand,
  VerifyEmailCommand,
} from './types/auth-commands';
import type { RegisterResult, VerifyEmailResult } from '../types/auth-result.types';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import { PASSWORD_PROVIDER, type PasswordProvider } from './ports/password.provider';
import { AUTH_USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { normalizeEmail, normalizeUsername } from './utils/normalization.utils';
import { InternalServerErrorException } from '@nestjs/common';
import { VerificationTokenService } from './verification-token.service';

@Injectable()
export class AuthRegistrationService {
  private static readonly RESEND_VERIFICATION_GENERIC_MESSAGE =
    'If this email exists and is not verified, a verification email has been sent.';
  private static readonly REGISTER_GENERIC_MESSAGE =
    'If your registration can be completed, a verification email will be sent.';

  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
    @Inject(PASSWORD_PROVIDER)
    private readonly passwordProvider: PasswordProvider,
    private readonly verificationTokenService: VerificationTokenService,
    @InjectPinoLogger(AuthRegistrationService.name) private readonly logger: PinoLogger,
  ) {}

  async register(registerCommand: RegisterCommand): Promise<RegisterResult> {
    const normalizedEmail = normalizeEmail(registerCommand.email);
    const normalizedUsername = normalizeUsername(registerCommand.username);

    const existingUser: { userId: string; email: string; isVerified: boolean } | null =
      await this.userRepository.findActiveVerificationStatusByEmail(normalizedEmail);

    if (existingUser) {
      if (!existingUser.isVerified) {
        try {
          await this.verificationTokenService.issueAndSendVerificationToken(
            existingUser.userId,
            existingUser.email,
          );
        } catch (error) {
          this.logger.error({
            event: 'auth_register_existing_unverified_enqueue_failed',
            userId: existingUser.userId,
            message: error instanceof Error ? error.message : 'Unknown enqueue error',
          });
        }
      }

      return {
        message: AuthRegistrationService.REGISTER_GENERIC_MESSAGE,
      };
    }

    // Remove the pre-check availability guard: it creates a TOCTOU race where two
    // concurrent registrations with the same email both pass the check and one fails
    // on the unique constraint with a 500 error. Instead, we rely on the unique
    // constraint as the single source of truth and convert DB constraint errors to
    // 409 Conflict responses (BLOCK-4 fix).
    //
    // Phase 0 #2: `createUserWithPasswordHistory` wraps the user-row INSERT
    // AND the initial `password_history` INSERT in a single transaction. If
    // either write fails (e.g. unique-constraint on `users.email`) the whole
    // registration rolls back, so we never end up with a user row that has no
    // history entry — which would silently disable the password-reuse
    // policy for that user on their first change.
    const passwordHash = await this.passwordProvider.hash(registerCommand.password);
    const nowIso = new Date().toISOString();

    let createdUser: Awaited<ReturnType<UserRepositoryPort['createUserWithPasswordHistory']>>;
    try {
      createdUser = await this.userRepository.createUserWithPasswordHistory({
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        nowIso,
      });
    } catch (error) {
      if (
        error instanceof InternalServerErrorException &&
        (error.message.includes('unique') ||
          error.message.includes('duplicate') ||
          error.message.includes('key'))
      ) {
        this.logger.warn({ event: 'auth_register_duplicate_constraint' });
        return { message: AuthRegistrationService.REGISTER_GENERIC_MESSAGE };
      }
      throw error;
    }

    try {
      await this.verificationTokenService.issueAndSendVerificationToken(
        createdUser.userId,
        createdUser.email,
      );
    } catch (error) {
      this.logger.error({
        event: 'auth_register_verification_enqueue_failed',
        userId: createdUser.userId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });
    }

    return {
      message: AuthRegistrationService.REGISTER_GENERIC_MESSAGE,
    };
  }

  async verifyEmail(command: VerifyEmailCommand): Promise<VerifyEmailResult> {
    const tokenHash = this.cryptoService.hashSha256(command.token);
    const nowIso = new Date().toISOString();

    const user: { userId: string; email: string } | null =
      await this.userRepository.findUserByActiveVerificationToken(tokenHash, nowIso);
    if (user) {
      await this.userRepository.markEmailAsVerified(user.userId, nowIso);

      this.logger.info({
        event: 'auth_email_verified',
        userId: user.userId,
      });
    }

    return {
      message: 'Verification processed. If valid, your email is now verified.',
    };
  }

  async resendVerificationEmail(
    command: ResendVerificationEmailCommand,
  ): Promise<VerifyEmailResult> {
    const normalizedEmail = normalizeEmail(command.email);
    const foundUser: { userId: string; email: string; isVerified: boolean } | null =
      await this.userRepository.findActiveVerificationStatusByEmail(normalizedEmail);

    if (!foundUser || foundUser.isVerified) {
      return {
        message: AuthRegistrationService.RESEND_VERIFICATION_GENERIC_MESSAGE,
      };
    }

    try {
      await this.verificationTokenService.issueAndSendVerificationToken(
        foundUser.userId,
        foundUser.email,
      );
    } catch (error) {
      this.logger.error({
        event: 'auth_resend_verification_email_enqueue_failed',
        userId: foundUser.userId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });
    }

    return {
      message: AuthRegistrationService.RESEND_VERIFICATION_GENERIC_MESSAGE,
    };
  }
}
