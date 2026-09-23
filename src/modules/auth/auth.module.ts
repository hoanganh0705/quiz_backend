import { Module } from '@nestjs/common';
import { AuthController } from './transport/controller/auth.controller';
import { AuthApplicationService } from './application/auth.application.service';
import { AuthResponseMapper } from './mappers/auth-response.mapper';
import { AuthPresenter } from './transport/presenters/auth.presenter';
import { AuthLoginService } from './domain/auth-login.service';
import { AuthRefreshService } from './domain/auth-refresh.service';
import { AuthRegistrationService } from './domain/auth-registration.service';
import { PasswordResetService } from './domain/password-reset.service';
import { ChangePasswordService } from './domain/change-password.service';
import { SessionManagementService } from './domain/session-management.service';
import { TokenConfig } from './config/token.config';
import { SessionConfig } from './config/session.config';
import { EmailVerificationConfig } from './config/email-verification-token.config';
import { PasswordResetConfig } from './config/password-reset-token.config';
import { SecurityConfig } from './config/security.config';
import { GoogleOAuthConfig } from './config/google-oauth.config';
import { AuthCookieService } from './transport/cookies/auth-cookie.service';
import { AuthSessionCleanupService } from './infrastructure/session/auth-session-cleanup.service';
import { JwtTokenAdapter } from './infrastructure/tokens/jwt-token.adapter';
import { SessionService } from './domain/session.service';
import { SecurityService } from './domain/security.service';
import { AccountSecurityService } from './domain/account-security.service';
import { CredentialVerificationService } from './domain/credential-verification.service';
import { AccountDeletionService } from './domain/account-deletion.service';
import { RegistrationAvailabilityService } from './domain/registration-availability.service';
import { AuthRequestContextService } from './infrastructure/context/auth-request-context.service';
import { CommonModule } from '@/common/common.module';
import { DeviceParserService } from './infrastructure/context/device-parser.service';
import { PasswordAdapter } from './infrastructure/security/password.adapter';
import { CryptoAdapter } from './infrastructure/tokens/crypto.adapter';
import { RequestContextInterceptor } from './transport/interceptors/request-context.interceptor';
import { RefreshTokenInterceptor } from './transport/interceptors/refresh-token.interceptor';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { EmailModule } from '@/modules/email/email.module';
import { PASSWORD_PROVIDER } from './domain/ports/password.provider';
import { TOKEN_PROVIDER } from './domain/ports/token.provider';
import { CRYPTO_PROVIDER } from './domain/ports/crypto.provider';
import { AUTH_USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';
import { SESSION_REPOSITORY_PORT } from './domain/ports/session-repository.port';
import { EMAIL_PROVIDER } from './domain/ports/email.provider';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { UserIdentityRepository } from './infrastructure/repositories/aggregates/user-identity.repository';
import { UserRegistrationRepository } from './infrastructure/repositories/aggregates/user-registration.repository';
import { EmailVerificationRepository } from './infrastructure/repositories/aggregates/email-verification.repository';
import { PasswordResetTokensRepository } from './infrastructure/repositories/aggregates/password-reset-tokens.repository';
import { PasswordChangeRepository } from './infrastructure/repositories/aggregates/password-change.repository';
import { AccountLifecycleRepository } from './infrastructure/repositories/aggregates/account-lifecycle.repository';
import { UserSessionRepository } from './infrastructure/repositories/user-session.repository';
import { EmailService } from '@/modules/email/email.service';
import { VerificationTokenService } from './domain/verification-token.service';
import { OutboxAdapter } from './infrastructure/outbox/outbox.adapter';
import { OutboxProcessorService } from './infrastructure/outbox/outbox-processor.service';
import { OutboxNotifyListener } from './infrastructure/outbox/outbox-notify.listener';
import { AuthAuditLogService } from './infrastructure/audit/auth-audit-log.service';
import { OUTBOX_PORT } from './domain/ports/outbox.port';
import { SessionInvalidationBus } from './infrastructure/session/session-invalidation.bus';

import { OAuthLoginService } from './domain/oauth/oauth-login.service';
import { OAuthAccountRepository } from './infrastructure/oauth/oauth-account.repository';
import { GoogleOAuthAdapter } from './infrastructure/oauth/google-oauth.adapter';
import { OAUTH_ACCOUNT_REPOSITORY_PORT } from './domain/oauth/ports/oauth-account-repository.port';
import { OAUTH_PROVIDER_PORT } from './domain/oauth/ports/oauth-provider.port';
import { OAuthDomainEventPublisher } from './domain/oauth/events/oauth-domain-event-publisher';
import { OAUTH_DOMAIN_EVENT_PUBLISHER } from './domain/oauth/events/oauth-domain-event-publisher.port';
import { OAuthMetricsService } from './domain/oauth/oauth-metrics.service';
import { OAuthProviderRegistryAdapter } from './domain/oauth/oauth-provider-registry.adapter';
import { OAUTH_PROVIDER_REGISTRY } from './domain/oauth/ports/oauth-provider-registry.port';
import { OAuthIdentityResolver } from './domain/oauth/oauth-identity-resolver';
import { OAuthAccountLinker } from './domain/oauth/oauth-account-linker';
import { OAuthSessionIssuer } from './domain/oauth/oauth-session-issuer';
import { OAuthEventService } from './domain/oauth/oauth-event.service';
import { NotificationModule } from '@/modules/notification/notification.module';
import { IdempotencyCleanupScheduler } from './infrastructure/scheduler/idempotency-cleanup.scheduler';
import { SessionCleanupScheduler } from './infrastructure/scheduler/session-cleanup.scheduler';
import { OutboxCleanupScheduler } from '@/modules/outbox/infrastructure/scheduler/outbox-cleanup.scheduler';
@Module({
  imports: [CommonModule, DatabaseModule, RedisModule, EmailModule, NotificationModule],
  controllers: [AuthController],
  providers: [
    AuthApplicationService,
    AuthResponseMapper,

    AuthPresenter,

    AuthRegistrationService,
    AuthLoginService,
    AuthRefreshService,
    PasswordResetService,
    ChangePasswordService,
    SessionManagementService,
    VerificationTokenService,
    SessionService,
    SecurityService,
    AccountSecurityService,
    CredentialVerificationService,
    AccountDeletionService,
    RegistrationAvailabilityService,

    TokenConfig,
    SessionConfig,
    EmailVerificationConfig,
    PasswordResetConfig,
    SecurityConfig,

    AuthCookieService,
    AuthSessionCleanupService,
    AuthRequestContextService,
    DeviceParserService,
    RequestContextInterceptor,
    RefreshTokenInterceptor,
    UserRepository,
    UserIdentityRepository,
    UserRegistrationRepository,
    EmailVerificationRepository,
    PasswordResetTokensRepository,
    PasswordChangeRepository,
    AccountLifecycleRepository,
    UserSessionRepository,
    AuthAuditLogService,

    { provide: TOKEN_PROVIDER, useClass: JwtTokenAdapter },
    { provide: CRYPTO_PROVIDER, useClass: CryptoAdapter },
    { provide: PASSWORD_PROVIDER, useClass: PasswordAdapter },

    { provide: AUTH_USER_REPOSITORY_PORT, useExisting: UserRepository },
    { provide: SESSION_REPOSITORY_PORT, useExisting: UserSessionRepository },
    { provide: EMAIL_PROVIDER, useExisting: EmailService },
    { provide: OUTBOX_PORT, useExisting: OutboxAdapter },
    { provide: OAUTH_ACCOUNT_REPOSITORY_PORT, useExisting: OAuthAccountRepository },

    {
      provide: OAUTH_PROVIDER_PORT,
      useExisting: GoogleOAuthAdapter,
    },

    { provide: OAUTH_DOMAIN_EVENT_PUBLISHER, useExisting: OAuthDomainEventPublisher },

    { provide: OAUTH_PROVIDER_REGISTRY, useExisting: OAuthProviderRegistryAdapter },

    OutboxAdapter,
    OutboxProcessorService,
    OutboxNotifyListener,
    GoogleOAuthConfig,
    GoogleOAuthAdapter,
    OAuthAccountRepository,
    OAuthDomainEventPublisher,
    OAuthMetricsService,
    OAuthProviderRegistryAdapter,
    OAuthIdentityResolver,
    OAuthAccountLinker,
    OAuthSessionIssuer,
    OAuthEventService,
    OAuthLoginService,

    SessionInvalidationBus,

    IdempotencyCleanupScheduler,
    SessionCleanupScheduler,
    OutboxCleanupScheduler,
  ],
  exports: [AuthApplicationService],
})
export class AuthModule {}
