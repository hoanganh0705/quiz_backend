import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InvalidOAuthTokenError } from '../errors';
import { OAuthProvider } from './oauth.types';
import { OAUTH_PROVIDER_PORT, OAuthProviderPort } from './ports/oauth-provider.port';
import { OAuthProviderRegistry } from './ports/oauth-provider-registry.port';

/**
 * Registry that resolves provider adapters from a Map.
 * Adapters are registered via NestJS multi-providers on OAUTH_PROVIDER_PORT.
 */
@Injectable()
export class OAuthProviderRegistryAdapter implements OAuthProviderRegistry {
  private readonly adapters = new Map<OAuthProvider, OAuthProviderPort>();

  constructor(
    @InjectPinoLogger(OAuthProviderRegistryAdapter.name) private readonly logger: PinoLogger,
    // NestJS multi-provider: all OAuthProviderPort adapters are injected as an array
    @Inject(OAUTH_PROVIDER_PORT) allAdapters: OAuthProviderPort | OAuthProviderPort[],
  ) {
    const adapters = Array.isArray(allAdapters) ? allAdapters : [allAdapters];

    for (const adapter of adapters) {
      this.adapters.set(adapter.provider as OAuthProvider, adapter);
    }
    this.logger.info({
      event: 'auth.oauth.registry_initialized',
      providers: [...this.adapters.keys()],
    });
  }

  get(provider: OAuthProvider): OAuthProviderPort {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      this.logger.error({
        event: 'auth.oauth.unknown_provider',
        provider,
        availableProviders: [...this.adapters.keys()],
      });
      throw new InvalidOAuthTokenError(`Unsupported OAuth provider: ${provider}`);
    }
    return adapter;
  }
}
