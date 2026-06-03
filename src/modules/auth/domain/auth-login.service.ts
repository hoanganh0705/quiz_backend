import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { LoginCommand } from './types/auth-commands';
import type { AuthIdentity, SessionRequestContext } from '../types/auth-context.types';
import type { LoginResult } from '../types/auth-result.types';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { TOKEN_PROVIDER, type TokenProvider } from './ports/token.provider';
import { SessionService } from './session.service';
import { SecurityService } from './security.service';
import { InvalidCredentialsError } from './errors';
import { VerificationTokenService } from './verification-token.service';

@Injectable()
export class AuthLoginService {
  private static readonly DUMMY_PASSWORD_HASH =
    '$2b$12$4HFj7c4f1QH7wHTQXhH1ueYCMr5xM9A2m8K6q9M2m6I6QfZlq6QmW';

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenService: TokenProvider,
    private readonly sessionService: SessionService,
    private readonly securityService: SecurityService,
    private readonly verificationTokenService: VerificationTokenService,
    @InjectPinoLogger(AuthLoginService.name) private readonly logger: PinoLogger,
  ) {}

  private toAuthIdentity(user: {
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
  }): AuthIdentity {
    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  async login(loginCommand: LoginCommand, context: SessionRequestContext): Promise<LoginResult> {
    await this.securityService.enforceLoginRateLimit(context);

    const normalizedEmail = loginCommand.email.trim().toLowerCase();
    const foundUser = await this.userRepository.findActiveByEmailWithPassword(normalizedEmail);

    if (!foundUser) {
      // Keep similar compute cost across failure paths to reduce timing-based account probing.
      await bcrypt.compare(loginCommand.password, AuthLoginService.DUMMY_PASSWORD_HASH);
      this.logger.warn({ event: 'auth_login_failed' });
      throw new InvalidCredentialsError();
    }

    await this.securityService.enforceLoginRateLimit(context, foundUser.userId);

    if (!foundUser.isVerified) {
      // Keep similar compute cost across failure paths to reduce timing-based account probing.
      await bcrypt.compare(loginCommand.password, AuthLoginService.DUMMY_PASSWORD_HASH);
      this.logger.warn({ event: 'auth_login_failed', userId: foundUser.userId });
      // Fire-and-forget so login timing is not coupled to Redis/queue/provider latency.
      void this.securityService
        .tryAcquireLoginUnverifiedVerificationEmailSlot(foundUser.userId)
        .then((canEnqueue) => {
          if (!canEnqueue) return;
          return this.verificationTokenService.issueAndSendVerificationToken(
            foundUser.userId,
            foundUser.email,
          );
        })
        .catch((error) => {
          this.logger.error({
            event: 'auth_login_unverified_enqueue_failed',
            userId: foundUser.userId,
            message: error instanceof Error ? error.message : 'Unknown enqueue error',
          });
        });
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(loginCommand.password, foundUser.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn({ event: 'auth_login_invalid_password', userId: foundUser.userId });
      throw new InvalidCredentialsError();
    }

    const identity = this.toAuthIdentity(foundUser);
    const sessionId = randomUUID();
    const tokens = await this.tokenService.issueTokens(identity, sessionId);

    await this.sessionService.createSession(
      identity.userId,
      tokens.refreshToken,
      tokens.refreshTokenJti,
      context,
      sessionId,
    );

    return {
      userId: identity.userId,
      username: identity.username,
      email: identity.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId,
    };
  }
}
