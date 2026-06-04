import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Google OAuth configuration.
 * Loaded from environment variables so credentials are never hardcoded.
 */
@Injectable()
export class GoogleOAuthConfig {
  constructor(private readonly configService: ConfigService) {}

  get clientId(): string {
    const value = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!value) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
    }
    return value;
  }

  /**
   * Optional: restrict sign-in to a specific hosted domain (e.g. "example.com").
   * Leave unset to allow any Google account.
   */
  get hostedDomain(): string | undefined {
    return this.configService.get<string>('GOOGLE_HOSTED_DOMAIN');
  }
}
