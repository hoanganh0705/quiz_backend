import { Module } from '@nestjs/common';
import { AuthController } from './transport/controller/auth.controller';
import { AuthApplicationService } from './application/auth.application.service';
import { AuthResponseMapper } from './mappers/auth-response.mapper';
import { AuthService } from './domain/auth.service';
import { AuthConfig } from './auth.config';
import { AuthCookieService } from './transport/cookies/auth-cookie.service';
import { AuthSessionCleanupService } from './infrastructure/auth-session-cleanup.service';
import { JwtTokenAdapter } from './infrastructure/jwt-token.adapter';
import { SessionService } from './domain/session.service';
import { SecurityService } from './domain/security.service';
import { AuthRequestContextService } from './infrastructure/auth-request-context.service';
import { CommonModule } from '@/common/common.module';
import { DeviceParserService } from './infrastructure/device-parser.service';
import { CryptoAdapter } from './infrastructure/crypto.adapter';
import { RequestContextInterceptor } from './transport/interceptors/request-context.interceptor';
import { RefreshTokenInterceptor } from './transport/interceptors/refresh-token.interceptor';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { EmailModule } from '@/modules/email/email.module';
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
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [CommonModule, DatabaseModule, RedisModule, EmailModule, LoggerModule.forRoot()],
  controllers: [AuthController],
  providers: [
    AuthApplicationService,
    AuthResponseMapper,
    AuthService,
    AuthConfig,
    AuthCookieService,
    AuthSessionCleanupService,
    SessionService,
    SecurityService,
    AuthRequestContextService,
    DeviceParserService,
    RequestContextInterceptor,
    RefreshTokenInterceptor,
    AuthDomainExceptionFilter,
    { provide: TOKEN_PROVIDER, useClass: JwtTokenAdapter },
    { provide: CRYPTO_PROVIDER, useClass: CryptoAdapter },
    { provide: USER_REPOSITORY_PORT, useExisting: UserRepository },
    { provide: SESSION_REPOSITORY_PORT, useExisting: UserSessionRepository },
    { provide: EMAIL_PROVIDER, useExisting: EmailService },
    { provide: CACHE_PROVIDER, useExisting: RedisService },
  ],
  exports: [AuthApplicationService, AuthService],
})
export class AuthModule {}
