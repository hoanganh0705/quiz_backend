/**
 * Security configuration.
 * Provides typed access to security-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  sessionBindingStrict: process.env.SESSION_BINDING_STRICT === 'true',
}));

export type SecurityConfig = ConfigType<typeof securityConfig>;
