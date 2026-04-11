import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { CryptoService } from './service/crypto.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [JwtGuard, RolesGuard, CryptoService],
  exports: [JwtModule, JwtGuard, RolesGuard, CryptoService],
})
export class CommonModule {}
