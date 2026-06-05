import type { OAuthProvider } from '../oauth.types';
import type { OAuthProviderPort } from './oauth-provider.port';

/**
 * Looks up the appropriate OAuth provider adapter by provider name.
 * New providers (github, apple, microsoft) can be registered here
 * without modifying any service code — Open/Closed Principle.
 */
export interface OAuthProviderRegistry {
  get(provider: OAuthProvider): OAuthProviderPort;
}

export const OAUTH_PROVIDER_REGISTRY = Symbol('OAUTH_PROVIDER_REGISTRY');
