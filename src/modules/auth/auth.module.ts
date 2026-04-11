import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CryptoService } from '../../common/service/crypto.service';

@Module({
  // import JwtModule to use its providers
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, CryptoService], // what can be injected into constructors of other providers in this module
  exports: [AuthService], // export AuthService for use in other modules
})
export class AuthModule {}
