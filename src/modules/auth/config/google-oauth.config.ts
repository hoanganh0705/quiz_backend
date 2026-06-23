import { Inject, Injectable } from '@nestjs/common';
import { googleOAuthConfig } from '@/core/config';
import type { GoogleOAuthConfig as CoreGoogleOAuthConfig } from '@/core/config';

/**
 * Google OAuth configuration wrapper.
 * Preserves the @Injectable() surface consumed by GoogleOAuthAdapter.
 */
@Injectable()
export class GoogleOAuthConfig {
  constructor(
    @Inject(googleOAuthConfig.KEY)
    private readonly config: CoreGoogleOAuthConfig,
  ) {}

  get clientId(): string {
    const value = this.config.clientId;
    if (!value) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
    }
    return value;
  }

  /** Optional: restrict sign-in to a specific hosted domain (e.g. "example.com"). */
  get hostedDomain(): string | undefined {
    const value = this.config.hostedDomain;
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }
}
