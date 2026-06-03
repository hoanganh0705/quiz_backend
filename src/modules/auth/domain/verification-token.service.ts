import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EmailVerificationConfig } from '../config/email-verification.config';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import { EMAIL_PROVIDER, type EmailProvider } from './ports/email.provider';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';

@Injectable()
export class VerificationTokenService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
    private readonly emailVerificationConfig: EmailVerificationConfig,
    @Inject(EMAIL_PROVIDER)
    private readonly emailService: EmailProvider,
  ) {}

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getVerificationExpiryIso(): string {
    return new Date(
      Date.now() + this.emailVerificationConfig.tokenTtlSeconds * 1_000,
    ).toISOString();
  }

  async issueAndSendVerificationToken(userId: string, email: string): Promise<void> {
    const rawToken = this.generateVerificationToken();
    const tokenHash = this.cryptoService.hashSha256(rawToken);
    const expiresAtIso = this.getVerificationExpiryIso();

    await this.userRepository.setEmailVerificationToken(userId, tokenHash, expiresAtIso);

    await this.emailService.enqueueVerificationEmail(email, rawToken, userId);
  }
}
