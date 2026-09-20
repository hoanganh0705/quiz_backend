import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { CommonModule } from './common/common.module';
import { JwtGuard } from './common/guards/jwt.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseFormatInterceptor } from './common/interceptors/response-format.interceptor';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
import { ObservabilityModule } from './core/observability/observability.module';
import { HttpTracingInterceptor } from './core/observability/http-tracing.interceptor';
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
import { CommentModule } from './modules/comment/comment.module';
import { DailyChallengeModule } from './modules/daily-challenge/daily-challenge.module';
import { HomeModule } from './modules/home/home.module';
import { CoinModule } from './modules/coins/coin.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminModule } from './modules/admin/admin.module';
import { StorageModule } from './core/storage';
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
  passwordResetConfig,
  authSecurityConfig,
  authThrottleConfig,
  googleOAuthConfig,
  swaggerConfig,
  cloudinaryConfig,
} from './core/config';
import { RedisModule } from './core/redis/redis.module';
import { PermissionsGuard } from './common/authorization/guards/permissions.guard';
import { SocialModule } from './modules/social/social.module';
import { SearchModule } from './modules/search/search.module';
import { HealthModule } from './modules/health/health.module';
import { CoreLoggerModule } from './core/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
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
        passwordResetConfig,
        authSecurityConfig,
        authThrottleConfig,
        googleOAuthConfig,
        swaggerConfig,
        cloudinaryConfig,
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
    RedisModule,
    DatabaseModule,
    StorageModule.forRoot(),
    UploadModule,
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
    CommentModule,
    SocialModule,
    SearchModule,
    HealthModule,
    DailyChallengeModule,
    HomeModule,
    ObservabilityModule,
    AdminModule,
    CoinModule,
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
      provide: APP_INTERCEPTOR,
      useClass: HttpTracingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
