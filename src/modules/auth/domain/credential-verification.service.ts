import { Inject, Injectable } from '@nestjs/common';
import { AUTH_USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { PASSWORD_PROVIDER, type PasswordProvider } from './ports/password.provider';
import type { CredentialVerificationResult } from '../types/auth-result.types';

@Injectable()
export class CredentialVerificationService {
  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_PROVIDER)
    private readonly passwordProvider: PasswordProvider,
  ) {}

  async verifyPassword(userId: string, password: string): Promise<CredentialVerificationResult> {
    const credentials = await this.userRepository.findActiveUserCredentialsById(userId);
    if (!credentials) {
      return { valid: false };
    }

    const valid = await this.passwordProvider.verify(password, credentials.passwordHash);
    return { valid };
  }
}
