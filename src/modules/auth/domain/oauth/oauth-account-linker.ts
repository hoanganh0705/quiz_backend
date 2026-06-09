import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OAuthAccountRepositoryPort } from './ports/oauth-account-repository.port';
import { OAUTH_ACCOUNT_REPOSITORY_PORT } from './ports/oauth-account-repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../ports/user-repository.port';
import { deriveOAuthUsername } from './utils/derive-oauth-username';
import type { OAuthProvider } from './oauth.types';
import type { OutboxPort } from '../ports/outbox.port';
import { OUTBOX_PORT } from '../ports/outbox.port';
import type { UserRole } from '@/common/types/user-role.type';

/**
 * OAuthAccountLinker
 *
 * Responsible ONLY for:
 * - Checking if an OAuth link already exists
 * - Checking for an existing user with the same email
 * - Auto-linking verified users
 * - Creating new OAuth users
 * - Scheduling integration events (inside transactions)
 *
 * Does NOT enforce email verification — that is the job of OAuthIdentityResolver.
 */
@Injectable()
export class OAuthAccountLinker {
  constructor(
    @Inject(OAUTH_ACCOUNT_REPOSITORY_PORT)
    private readonly oauthAccountRepository: OAuthAccountRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @InjectPinoLogger(OAuthAccountLinker.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Finds an existing OAuth link by provider + providerUserId.
   * Returns the linked user identity if found.
   */
  async findExistingLink(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<{
    userId: string;
    username: string;
    email: string;
    role: 'admin' | 'moderator' | 'user';
  } | null> {
    const record = await this.oauthAccountRepository.findByProviderAndProviderUserId(
      provider,
      providerUserId,
    );
    if (!record) return null;

    const user = await this.userRepository.findActiveIdentityById(record.userId);
    return user ?? null;
  }

  /**
   * Finds an existing verified user by email for auto-linking.
   * Returns null if no user exists, or if the user is unverified.
   * The caller should throw OAuthAccountLinkingRequiredError for unverified users.
   */
  async findLinkableUserByEmail(email: string): Promise<{
    userId: string;
    username: string;
    email: string;
    isVerified: boolean;
    role: 'admin' | 'moderator' | 'user';
  } | null> {
    return this.userRepository.findActiveIdentityByEmail(email);
  }

  /**
   * Auto-links a verified OAuth account to an existing user.
   * The OAuth link + outbox event are written atomically inside the repository tx.
   */
  async autoLink(params: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
  }): Promise<void> {
    await this.oauthAccountRepository.linkOAuthAccountToExistingUser(params);
    this.logger.info({
      event: 'oauth_account_linked',
      userId: params.userId,
      provider: params.provider,
      providerUserId: params.providerUserId,
    });
  }

  /**
   * Creates a new user and OAuth link atomically.
   * The user + OAuth link + outbox event are written inside the repository tx.
   */
  async createUserWithLink(params: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
  }): Promise<{
    userId: string;
    username: string;
    email: string;
    role: UserRole;
    oauthAccountId: string;
  }> {
    const username = deriveOAuthUsername(params.email, crypto.randomUUID());
    const result = await this.oauthAccountRepository.createOAuthUserWithLink({
      ...params,
      username,
    });
    this.logger.info({
      event: 'oauth_account_created',
      userId: result.userId,
      provider: params.provider,
      username: result.username,
    });
    return result;
  }
}
