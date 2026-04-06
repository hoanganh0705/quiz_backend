import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { CoreLoggerModule } from './core/logger/logger.module';
import { CommonModule } from './common/common.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [CoreLoggerModule, DatabaseModule, UserModule, AuthModule, CommonModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
