/**
 * OAuth Account Record type.
 * Used by the repository port to return OAuth identity links to domain callers.
 */
export type OAuthAccountRecord = {
  oauthAccountId: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  createdAt: string;
};

/**
 * OAuth Provider type.
 * Validated at the application layer, not enforced at the database level.
 */
export type OAuthProvider = 'google';
