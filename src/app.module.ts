import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { CoreLoggerModule } from './core/logger/logger.module';
import { CommonModule } from './common/common.module';
import { JwtGuard } from './common/guards/jwt.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseFormatInterceptor } from './common/interceptors/response-format.interceptor';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
import { CategoryModule } from './modules/category/category.module';
import { TagModule } from './modules/tag/tag.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { AttemptModule } from './modules/attempt/attempt.module';
import { BookmarkModule } from './modules/bookmark/bookmark.module';
import { ReviewModule } from './modules/review/review.module';
import { TournamentModule } from './modules/tournament/tournament.module';
import { InstanceModule } from './modules/instance/instance.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { AchievementModule } from './modules/achievement/achievement.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DiscussionModule } from './modules/discussion/discussion.module';
import {
  validateEnv,
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  emailConfig,
  emailVerificationConfig,
  securityConfig,
  serverConfig,
  sessionsConfig,
} from './core/config';
import { RedisModule } from './core/redis/redis.module';
import { RolesGuard } from './common/authorization/guards/roles.guard';
import { PermissionsGuard } from './common/authorization/guards/permissions.guard';
import { LoggerModule } from 'nestjs-pino';
import { SocialModule } from './modules/social/social.module';
import { SearchModule } from './modules/search/search.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // forRoot is a way to create a singleton instance of the module that can be shared across the entire application. This is useful for modules that provide services or configurations that should be consistent throughout the app, such as ConfigModule for environment variables, ThrottlerModule for rate limiting, ScheduleModule for cron jobs, and CoreLoggerModule for logging. By using forRoot, we ensure that there is only one instance of these modules and their services, which can be injected into any other module or controller that needs them. For feature modules like UserModule, AuthModule, etc., we typically just import them directly without forRoot, as they are designed to be imported multiple times if needed and do not maintain global state.
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true, // allow env like FOO='${BAR}_suffix' to be expanded to the value of BAR + '_suffix'
      validate: validateEnv,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        emailConfig,
        emailVerificationConfig,
        securityConfig,
        serverConfig,
        sessionsConfig,
      ],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          limit: 100,
          ttl: 60_000,
        },
      ],
      skipIf: (context) => {
        const request = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
        const path = request.path ?? request.url ?? '';
        return path.startsWith('/internal');
      },
    }),
    ScheduleModule.forRoot(),
    CoreLoggerModule,
    LoggerModule.forRoot(),
    RedisModule,
    DatabaseModule,
    UserModule,
    AuthModule,
    CommonModule,
    CategoryModule,
    TagModule,
    QuizModule,
    AttemptModule,
    BookmarkModule,
    ReviewModule,
    TournamentModule,
    InstanceModule,
    RankingModule,
    AchievementModule,
    NotificationModule,
    DiscussionModule,
    SocialModule,
    SearchModule,
    HealthModule,
  ],
  // providers is a list of global guards, interceptors, and filters that will be applied to all routes in the application. The order of providers matters: guards will execute in the order they are defined, then interceptors, and finally filters will catch exceptions thrown by guards or interceptors. Why do we have provider ? Because we want to apply these guards, interceptors, and filters globally across the entire application, so we use the APP_GUARD, APP_INTERCEPTOR, and APP_FILTER tokens to tell NestJS to use these classes as global providers for their respective types. This way, we don't have to manually apply these guards/interceptors/filters to each controller or route handler; they will automatically be applied to all of them. In normal modules, providers are typically used to define services that can be injected into controllers or other services. However, when we want to apply something globally across the entire application, we use these special tokens to register them as global providers.
  providers: [
    // Execute coarse throttling first to reduce JWT verification load during abusive traffic.
    // provide and useClass are used to say that whenever some modules inject APP_GUARD, they should use the ThrottlerGuard class as the implementation. This is how we register global guards in NestJS. The same goes for the other guards, interceptors, and filters listed here. By doing this, we ensure that these guards/interceptors/filters are applied to all routes in the application without having to specify them in each controller or route handler. In other modules, provide and useClass are used for special reason, for example, if some modules inject USER_REPOSITORY_PORT, it means Nestjs will create an instance of UserRepository and inject it wherever USER_REPOSITORY_PORT is injected. This is a way to abstract away the implementation details and allow for easier testing and flexibility in swapping out implementations if needed.
    // provide and useExisting are used when we want to alias one provider to another. For example, if we have a provider that is already registered for a class, and we want to use that same instance for a different token, we can use useExisting to point to the existing provider instead of creating a new instance. This is useful for cases where multiple guards or interceptors might share the same underlying implementation or when we want to reuse an existing service without creating a new provider for it.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseFormatInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
