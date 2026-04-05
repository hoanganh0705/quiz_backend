import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';

@Module({
  imports: [JwtModule],
  providers: [JwtGuard],
  exports: [JwtGuard],
})
export class CommonModule {}
