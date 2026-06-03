import { Module } from '@nestjs/common';
import { AuthController } from './transport/controller/auth.controller';
import { AuthApplicationService } from './application/auth.application.service';
import { AuthResponseMapper } from './mappers/auth-response.mapper';
import { AuthLoginService } from './domain/auth-login.service';
import { AuthRefreshService } from './domain/auth-refresh.service';
import { AuthRegistrationService } from './domain/auth-registration.service';
import { PasswordResetService } from './domain/password-reset.service';
import { ChangePasswordService } from './domain/change-password.service';
import { SessionManagementService } from './domain/session-management.service';
import { AuthSecurityEventPublisher } from './domain/events/auth-security-event-bus';
import { AUTH_SECURITY_EVENT_BUS } from './domain/events/auth-security-event-bus.port';
import { TokenConfig } from './config/token.config';
import { SessionConfig } from './config/session.config';
import { EmailVerificationConfig } from './config/email-verification.config';
import { PasswordResetConfig } from './config/password-reset.config';
import { AuthCookieService } from './transport/cookies/auth-cookie.service';
import { AuthSessionCleanupService } from './infrastructure/session/auth-session-cleanup.service';
import { JwtTokenAdapter } from './infrastructure/tokens/jwt-token.adapter';
import { SessionService } from './domain/session.service';
import { SecurityService } from './domain/security.service';
import { AccountSecurityService } from './domain/account-security.service';
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
import { USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';
import { SESSION_REPOSITORY_PORT } from './domain/ports/session-repository.port';
import { EMAIL_PROVIDER } from './domain/ports/email.provider';
import { CACHE_PROVIDER } from './domain/ports/cache.provider';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { UserSessionRepository } from './infrastructure/repositories/user-session.repository';
import { RedisService } from '@/core/redis/redis.service';
import { EmailService } from '@/modules/email/email.service';
import { AuthDomainExceptionFilter } from './transport/filters/auth-domain-exception.filter';
import { VerificationTokenService } from './domain/verification-token.service';

@Module({
  imports: [CommonModule, DatabaseModule, RedisModule, EmailModule],
  controllers: [AuthController],
  providers: [
    // Application
    AuthApplicationService,
    AuthResponseMapper,
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
    // Event publisher
    AuthSecurityEventPublisher,
    // Config classes
    TokenConfig,
    SessionConfig,
    EmailVerificationConfig,
    PasswordResetConfig,
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
    // Port adapters
    { provide: TOKEN_PROVIDER, useClass: JwtTokenAdapter },
    { provide: CRYPTO_PROVIDER, useClass: CryptoAdapter },
    { provide: PASSWORD_PROVIDER, useClass: PasswordAdapter },
    // Port bindings
    { provide: USER_REPOSITORY_PORT, useExisting: UserRepository },
    { provide: SESSION_REPOSITORY_PORT, useExisting: UserSessionRepository },
    { provide: EMAIL_PROVIDER, useExisting: EmailService },
    { provide: CACHE_PROVIDER, useExisting: RedisService },
    { provide: AUTH_SECURITY_EVENT_BUS, useExisting: AuthSecurityEventPublisher },
  ],
  exports: [AuthApplicationService],
})
export class AuthModule {}
