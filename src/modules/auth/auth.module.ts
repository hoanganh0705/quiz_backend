import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthConfig } from './auth.config';
import { AuthCookieService } from './services/auth-cookie.service';
import { AuthSessionCleanupService } from './services/auth-session-cleanup.service';
import { CryptoService } from '../../common/service/crypto.service';
import { UserRepository } from './repositories/user.repository';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { SecurityService } from './services/security.service';

@Module({
  // import JwtModule to use its providers
  imports: [JwtModule.register({}), ScheduleModule.forRoot()],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthConfig,
    AuthCookieService,
    AuthSessionCleanupService,
    CryptoService,
    UserRepository,
    TokenService,
    SessionService,
    SecurityService,
  ], // what can be injected into constructors of other providers in this module
  exports: [AuthService], // export AuthService for use in other modules
})
export class AuthModule {}
