import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { CryptoService } from './service/crypto.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [JwtGuard, RolesGuard, PermissionsGuard, CryptoService],
  exports: [JwtModule, JwtGuard, RolesGuard, PermissionsGuard, CryptoService],
})
export class CommonModule {}
