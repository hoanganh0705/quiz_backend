import { Module } from '@nestjs/common';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [DatabaseModule, UserModule, AuthModule, CommonModule],
  providers: [],
})
export class AppModule {}
