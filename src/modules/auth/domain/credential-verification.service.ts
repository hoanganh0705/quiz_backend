import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { PASSWORD_PROVIDER, type PasswordProvider } from './ports/password.provider';
import type { CredentialVerificationResult } from '../types/auth-result.types';

@Injectable()
export class CredentialVerificationService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_PROVIDER)
    private readonly passwordProvider: PasswordProvider,
  ) {}

  async verifyPassword(userId: string, password: string): Promise<CredentialVerificationResult> {
    const identity = await this.userRepository.findActiveIdentityById(userId);
    if (!identity) {
      return { valid: false };
    }

    const userWithPassword = await this.userRepository.findActiveByEmailWithPassword(
      identity.email,
    );
    if (!userWithPassword) {
      return { valid: false };
    }

    const valid = await this.passwordProvider.verify(password, userWithPassword.passwordHash);
    return { valid };
  }
}
