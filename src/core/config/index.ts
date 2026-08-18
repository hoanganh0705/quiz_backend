/**
 * Configuration module barrel export.
 *
 * Provides typed configuration using NestJS registerAs() pattern.
 * All configs are loaded via ConfigModule.forRoot({ load: [...] }).
 *
 * Access patterns:
 *
 * // New typed access (recommended for new code)
 * configService.get('database.url')
 * configService.get('jwt.accessSecret')
 * configService.get('email.provider')
 *
 * // Old flat access (still works for backward compatibility)
 * configService.get('DATABASE_URL')
 * configService.get('JWT_ACCESS_TOKEN_SECRET')
 */

// Environment validation (must be loaded first for fail-fast)
export { validateEnv, type NodeEnv, type EmailProvider } from './env.validation';

// Configuration modules
export { appConfig, type AppConfig } from './app.config';
export { databaseConfig, type DatabaseConfig } from './database.config';
export { redisConfig, type RedisConfig } from './redis.config';
export { jwtConfig, type JwtConfig } from './jwt.config';
export { emailConfig, type EmailConfig } from './email.config';
export { emailVerificationConfig, type EmailVerificationConfig } from './email-verification.config';
export { securityConfig, type SecurityConfig } from './security.config';
export { serverConfig, type ServerConfig } from './server.config';
export { sessionsConfig, type SessionsConfig } from './sessions.config';
export { passwordResetConfig, type PasswordResetConfig } from './password-reset.config';
export { authSecurityConfig, type AuthSecurityConfig } from './auth-security.config';
export { authThrottleConfig, type AuthThrottleConfig } from './auth-throttle.config';
export { googleOAuthConfig, type GoogleOAuthConfig } from './google-oauth.config';
export { swaggerConfig, type SwaggerConfig } from './swagger.config';
export { cloudinaryConfig, type CloudinaryConfig } from './cloudinary.config';
