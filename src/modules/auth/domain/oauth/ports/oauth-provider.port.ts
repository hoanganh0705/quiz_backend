/**
 * The authentication payload shape accepted by all OAuth provider adapters.
 * Providers may require only a subset of these fields.
 *
 * - `idToken` — used by Google (OpenID Connect ID token)
 * - `code` — authorization code for server-side code exchange (GitHub, Microsoft)
 * - `accessToken` — opaque bearer token for direct API calls
 */
export type OAuthAuthenticationPayload = {
  code?: string;
  idToken?: string;
  accessToken?: string;
};

/**
 * Normalized user info returned by a successful provider authentication.
 * All downstream layers work exclusively with this shape.
 */
export type OAuthUserInfo = {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
};

/**
 * Port for OAuth provider implementations.
 *
 * Each adapter validates the provider-specific token (ID token, access token, etc.),
 * validates issuer, audience, and expiry, then returns a normalized OAuthUserInfo.
 *
 * Implementations must throw `InvalidOAuthTokenError` on any validation failure.
 * Provider tokens must NEVER be persisted after authentication completes.
 */
export interface OAuthProviderPort {
  readonly provider: 'google';

  /**
   * Authenticates a user via this provider.
   *
   * @throws {InvalidOAuthTokenError} on signature failure, expiry, wrong issuer/audience
   */
  authenticate(payload: OAuthAuthenticationPayload): Promise<OAuthUserInfo>;
}

export const OAUTH_PROVIDER_PORT = Symbol('OAUTH_PROVIDER_PORT');
