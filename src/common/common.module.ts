import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';

@Module({
  imports: [JwtModule.register({})],
  providers: [JwtGuard],
  exports: [JwtModule, JwtGuard],
})
export class CommonModule {}
