import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [JwtModule],
  providers: [JwtGuard, RolesGuard],
  exports: [JwtGuard, RolesGuard],
})
export class CommonModule {}
