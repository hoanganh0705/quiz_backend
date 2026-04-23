import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthConfig } from './auth.config';
import { AuthCookieService } from './services/auth-cookie.service';
import { AuthSessionCleanupService } from './services/auth-session-cleanup.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { SecurityService } from './services/security.service';
import { AuthRequestContextService } from './services/auth-request-context.service';
import { CommonModule } from '@/common/common.module';
import { DeviceParserService } from './services/device-parser.service';
import { CryptoService } from './services/crypto.service';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { EmailModule } from '@/modules/email/email.module';

@Module({
  imports: [CommonModule, DatabaseModule, RedisModule, EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthConfig,
    AuthCookieService,
    AuthSessionCleanupService,
    TokenService,
    SessionService,
    SecurityService,
    AuthRequestContextService,
    DeviceParserService,
    CryptoService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
