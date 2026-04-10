import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { CoreLoggerModule } from './core/logger/logger.module';
import { CommonModule } from './common/common.module';
import { JwtGuard } from './common/guards/jwt.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseFormatInterceptor } from './common/interceptors/response-format.interceptor';
import { CategoryModule } from './modules/category/category.module';
import { TagModule } from './modules/tag/tag.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { validateEnv } from './core/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true, //  allow env like FOO='${BAR}_suffix' to be expanded to the value of BAR + '_suffix'
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          limit: 60,
          ttl: 60_000,
        },
      ],
      skipIf: (context) => {
        const request = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
        const path = request.path ?? request.url ?? '';
        return path.startsWith('/internal');
      },
    }),
    CoreLoggerModule,
    DatabaseModule,
    UserModule,
    AuthModule,
    CommonModule,
    CategoryModule,
    TagModule,
    QuizModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseFormatInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
