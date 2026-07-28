import { Inject, Injectable } from '@nestjs/common';
import { AUTH_USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { UserNotFoundError } from './errors';
import type { CurrentUserResult } from '../types/auth-result.types';

export type AccountSecurityMetadata = {
  emailVerified: boolean;
  lastPasswordChangedAt: string | null;
  lastLoginAt: string | null;
  activeSessionCount: number;
};

/**
 * Aggregates the data backing `GET /auth/security/dashboard`.
 *
 * The dashboard is a security snapshot for the authenticated user, composed of
 * fields that originate in two distinct domain concerns:
 *
 * - **User-domain fields** (from `userRepository.getSecurityMetadata`):
 *   `emailVerified`, `lastPasswordChangedAt`, `lastLoginAt`.
 *
 * - **Session-domain field** (from the same repository call, which joins the
 *   `users` and `user_sessions` tables): `activeSessionCount`.
 *
 * The aggregation intentionally returns a flat snapshot rather than nested
 * domain objects — the controller layer composes the final `AccountSecurityDto`
 * (including derived fields like `passwordAgeDays`) so the service layer
 * stays focused on data lineage and the controller layer stays focused on
 * response shaping.
 */
@Injectable()
export class AccountSecurityService {
  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
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

  /**
   * Returns the raw data needed by the security dashboard. The application
   * service is responsible for deriving presentation-layer fields (e.g.
   * `passwordAgeDays`) from the timestamps returned here.
   */
  async getAccountSecurity(userId: string): Promise<AccountSecurityMetadata> {
    const metadata = await this.userRepository.getSecurityMetadata(userId);
    if (!metadata) {
      throw new UserNotFoundError();
    }
    return {
      emailVerified: metadata.emailVerified,
      lastPasswordChangedAt: metadata.lastPasswordChangedAt,
      lastLoginAt: metadata.lastLoginAt,
      activeSessionCount: metadata.activeSessionCount,
    };
  }
}
