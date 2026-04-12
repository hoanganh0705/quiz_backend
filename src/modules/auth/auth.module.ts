import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
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
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';

@Module({
  // import JwtModule to use its exported services (e.g., JwtService) in AuthService
  imports: [
    JwtModule.register({}),
    ScheduleModule.forRoot(),
    CommonModule,
    DatabaseModule,
    RedisModule,
  ],
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
  ], // what can be injected into constructors of other providers in this module
  exports: [AuthService], // export AuthService for use in other modules
})
export class AuthModule {}
