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
import { UserSessionRepository } from './infrastructure/repositories/user-session.repository';
import { EmailService } from '@/modules/email/email.service';
import { AuthDomainExceptionFilter } from './transport/filters/auth-domain-exception.filter';
import { VerificationTokenService } from './domain/verification-token.service';
import { OutboxAdapter } from './infrastructure/outbox/outbox.adapter';
import { OutboxProcessorService } from './infrastructure/outbox/outbox-processor.service';
import { AuthAuditLogService } from './infrastructure/audit/auth-audit-log.service';
import { AuthTransactionContext } from './infrastructure/transaction/auth-transaction.context';
import { TransactionalInterceptor } from './infrastructure/transaction/transactional.interceptor';
import { OUTBOX_PORT } from './domain/ports/outbox.port';
import { SessionInvalidationBus } from './infrastructure/session/session-invalidation.bus';

// OAuth domain
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
import { AuthSecurityNotificationService } from '@/modules/notification/domain/services/auth-security-notification.service';
@Module({
  imports: [CommonModule, DatabaseModule, RedisModule, EmailModule, NotificationModule],
  controllers: [AuthController],
  providers: [
    // Application
    AuthApplicationService,
    AuthResponseMapper,
    // Presentation
    AuthPresenter,
    // Domain services
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
    // Config classes
    TokenConfig,
    SessionConfig,
    EmailVerificationConfig,
    PasswordResetConfig,
    SecurityConfig,
    // Infrastructure
    AuthCookieService,
    AuthSessionCleanupService,
    AuthRequestContextService,
    DeviceParserService,
    RequestContextInterceptor,
    RefreshTokenInterceptor,
    AuthDomainExceptionFilter,
    UserRepository,
    UserSessionRepository,
    AuthAuditLogService,
    AuthTransactionContext,
    TransactionalInterceptor,
    // Port adapters
    { provide: TOKEN_PROVIDER, useClass: JwtTokenAdapter },
    { provide: CRYPTO_PROVIDER, useClass: CryptoAdapter },
    { provide: PASSWORD_PROVIDER, useClass: PasswordAdapter },
    // Port bindings
    { provide: AUTH_USER_REPOSITORY_PORT, useExisting: UserRepository },
    { provide: SESSION_REPOSITORY_PORT, useExisting: UserSessionRepository },
    { provide: EMAIL_PROVIDER, useExisting: EmailService },
    { provide: OUTBOX_PORT, useExisting: OutboxAdapter },
    { provide: OAUTH_ACCOUNT_REPOSITORY_PORT, useExisting: OAuthAccountRepository },
    // OAuth multi-provider: each provider adapter is registered as a multi-provider token.
    // OAuthProviderRegistryAdapter collects all of them via @Inject(OAUTH_PROVIDER_PORT).
    // Adding new providers (GitHub, Apple, Microsoft) requires only adding them here.
    {
      provide: OAUTH_PROVIDER_PORT,
      useFactory: (adapter: GoogleOAuthAdapter) => adapter,
      inject: [GoogleOAuthAdapter],
    },
    // OAuth domain event publisher
    { provide: OAUTH_DOMAIN_EVENT_PUBLISHER, useExisting: OAuthDomainEventPublisher },
    // OAuth provider registry
    { provide: OAUTH_PROVIDER_REGISTRY, useExisting: OAuthProviderRegistryAdapter },
    // OAuth infrastructure and services
    OutboxAdapter,
    OutboxProcessorService,
    AuthSecurityNotificationService,
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
    // Cross-instance session invalidation
    SessionInvalidationBus,
  ],
  exports: [AuthApplicationService],
})
export class AuthModule {}
