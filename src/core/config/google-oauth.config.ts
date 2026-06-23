/**
 * Google OAuth configuration.
 * Provides typed access to Google OAuth-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const googleOAuthConfig = registerAs('googleOAuth', () => ({
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  hostedDomain: process.env.GOOGLE_HOSTED_DOMAIN ?? '',
}));

export type GoogleOAuthConfig = ConfigType<typeof googleOAuthConfig>;
