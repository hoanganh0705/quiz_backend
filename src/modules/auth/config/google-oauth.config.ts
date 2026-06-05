import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MISSING_ENVIRONMENT_VARIABLE_SUFFIX = 'environment variable is not set';

/**
 * Google OAuth configuration.
 * Loaded from environment variables so credentials are never hardcoded.
 */
@Injectable()
export class GoogleOAuthConfig {
  constructor(private readonly configService: ConfigService) {}

  private getRequiredString(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`${key} ${MISSING_ENVIRONMENT_VARIABLE_SUFFIX}`);
    }

    return value;
  }

  get clientId(): string {
    return this.getRequiredString('GOOGLE_CLIENT_ID');
  }

  /**
   * Optional: restrict sign-in to a specific hosted domain (e.g. "example.com").
   * Leave unset to allow any Google account.
   */
  get hostedDomain(): string | undefined {
    return this.configService.get<string>('GOOGLE_HOSTED_DOMAIN');
  }
}
