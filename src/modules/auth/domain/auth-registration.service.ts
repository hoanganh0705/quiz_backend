import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  RegisterCommand,
  ResendVerificationEmailCommand,
  VerifyEmailCommand,
} from './types/auth-commands';
import type { RegisterResult, VerifyEmailResult } from '../types/auth-result.types';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { ResourceConflictError } from './errors';
import { VerificationTokenService } from './verification-token.service';

@Injectable()
export class AuthRegistrationService {
  private static readonly RESEND_VERIFICATION_GENERIC_MESSAGE =
    'If this email exists and is not verified, a verification email has been sent.';
  private static readonly REGISTER_GENERIC_MESSAGE =
    'If your registration can be completed, a verification email will be sent.';

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
    private readonly verificationTokenService: VerificationTokenService,
    @InjectPinoLogger(AuthRegistrationService.name) private readonly logger: PinoLogger,
  ) {}

  async register(registerCommand: RegisterCommand): Promise<RegisterResult> {
    const normalizedEmail = registerCommand.email.trim().toLowerCase();
    const normalizedUsername = registerCommand.username.trim().toLowerCase();

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

    try {
      await this.userRepository.ensureEmailAndUsernameAvailable(
        normalizedEmail,
        normalizedUsername,
      );
    } catch (error) {
      if (error instanceof ResourceConflictError) {
        this.logger.warn({ event: 'auth_register_conflict' });
        return {
          message: AuthRegistrationService.REGISTER_GENERIC_MESSAGE,
        };
      }
      throw error;
    }

    const passwordHash = await bcrypt.hash(registerCommand.password, 12);
    const createdUser = await this.userRepository.createUser(
      normalizedEmail,
      normalizedUsername,
      passwordHash,
    );

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
    const normalizedEmail = command.email.trim().toLowerCase();
    const foundUser: { userId: string; email: string; isVerified: boolean } | null =
      await this.userRepository.findActiveVerificationStatusByEmail(normalizedEmail);

    // Do not reveal account existence/verification state.
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
