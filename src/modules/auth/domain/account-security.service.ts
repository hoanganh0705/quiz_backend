import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { SessionService } from './session.service';
import { UserNotFoundError } from './errors';
import type { CurrentUserResult } from '../types/auth-result.types';

export type AccountSecurityMetadata = {
  emailVerified: boolean;
  lastPasswordChangedAt: string | null;
  lastLoginAt: string | null;
};

@Injectable()
export class AccountSecurityService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    private readonly sessionService: SessionService,
  ) {}

  async getCurrentUser(userId: string): Promise<CurrentUserResult> {
    const profile = await this.userRepository.findActiveUserProfile(userId);
    if (!profile) {
      throw new UserNotFoundError();
    }
    return {
      userId: profile.userId,
      username: profile.username,
      email: profile.email,
      role: profile.role,
      isVerified: profile.isVerified,
    };
  }

  async getAccountSecurity(userId: string): Promise<AccountSecurityMetadata> {
    const metadata = await this.userRepository.getSecurityMetadata(userId);
    if (!metadata) {
      throw new UserNotFoundError();
    }
    return {
      emailVerified: metadata.emailVerified,
      lastPasswordChangedAt: metadata.lastPasswordChangedAt,
      lastLoginAt: metadata.lastLoginAt,
    };
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    return this.sessionService.countActiveSessionsByUserId(userId);
  }
}
