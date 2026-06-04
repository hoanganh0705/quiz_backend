import type { OAuthAccountRecord, OAuthProvider } from '../oauth.types';

/**
 * Port for OAuth account persistence.
 * All multi-write operations own the transaction boundary.
 */
export interface OAuthAccountRepositoryPort {
  /**
   * Finds an existing OAuth link by provider and provider-assigned user ID.
   */
  findByProviderAndProviderUserId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccountRecord | null>;

  /**
   * Finds an existing OAuth link by user ID and provider.
   */
  findByUserIdAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccountRecord | null>;

  /**
   * Creates a new user and OAuth account link atomically.
   *
   * The repository generates a deterministic userId before any inserts,
   * derives username candidates from that ID, and uses the same ID for
   * both the `users` and `oauth_accounts` rows.
   *
   * Writes `oauth_account_created` to the outbox inside the same transaction.
   *
   * @throws {OAuthAccountAlreadyExistsError} if the provider+providerUserId link already exists
   */
  createOAuthUserWithLink(params: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
  }): Promise<{
    userId: string;
    username: string;
    email: string;
    role: string;
    oauthAccountId: string;
  }>;

  /**
   * Links an existing verified user to a new OAuth provider.
   *
   * Must ONLY be called for users whose `isVerified === true`.
   * The domain service is responsible for enforcing this precondition.
   *
   * Writes `oauth_account_linked` to the outbox inside the same transaction.
   *
   * @throws {OAuthAccountAlreadyExistsError} if the provider+providerUserId link already exists
   */
  linkOAuthAccountToExistingUser(params: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
  }): Promise<OAuthAccountRecord>;
}

export const OAUTH_ACCOUNT_REPOSITORY_PORT = Symbol('OAUTH_ACCOUNT_REPOSITORY_PORT');
