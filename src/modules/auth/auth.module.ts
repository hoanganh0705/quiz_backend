import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CryptoService } from '../../common/service/crypto.service';
import { AuthConfig } from './auth.config';
import { AuthCookieService } from './auth-cookie.service';
import { AuthSessionCleanupService } from './auth-session-cleanup.service';

@Module({
  // import JwtModule to use its providers
  imports: [JwtModule.register({}), ScheduleModule.forRoot()],
  controllers: [AuthController],
  providers: [AuthService, AuthConfig, AuthCookieService, CryptoService, AuthSessionCleanupService], // what can be injected into constructors of other providers in this module
  exports: [AuthService], // export AuthService for use in other modules
})
export class AuthModule {}
