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
// `CoreLoggerModule` (imported last on purpose) wraps
// `LoggerModule.forRootAsync(...)` and is declared `@Global()`, so the
// `PinoLogger` provider and every `PinoLogger:<context>` provider
// created by `createProvidersForDecorated()` are visible to every
// feature module without each one having to import `LoggerModule`.
//
// Why LAST: `nestjs-pino`'s `@InjectPinoLogger(ContextName)` decorator
// registers its context name into a module-level `Set` at IMPORT TIME
// (when the file containing the decorator is first evaluated). The
// `PinoLogger:<context>` providers are only created when
// `LoggerModule.forRootAsync(...)` calls `createProvidersForDecorated()`.
// If `CoreLoggerModule` were imported before any feature module, that
// snapshot would be empty and every `@InjectPinoLogger` injection
// (e.g. `PinoLogger:CategoryDomainService`) would fail DI resolution.
//
// Placing the `import` statement at the bottom of this file (after
// every feature module import) guarantees all decorator files have
// been evaluated before `forRootAsync(...)` runs.
import { CoreLoggerModule } from './core/logger/logger.module';

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
    // `CoreLoggerModule` provides the ROOT Pino instance and the
    // HTTP access-log middleware via `LoggerModule.forRootAsync(...)`
    // with our redaction paths and serializers. It MUST be imported
    // first in this `imports` array (so the global `PinoLogger`
    // provider is wired before any feature module is instantiated) and
    // LAST in the import statements at the top of this file (so its
    // `forRootAsync(...)` snapshot of the `decoratedLoggers` Set
    // already contains every `@InjectPinoLogger(ContextName)` context
    // registered by feature-module decorators — see the comment next
    // to the `import` statement above).
    CoreLoggerModule,
    RedisModule,
    DatabaseModule,
    // Phase 3 — Cloudinary abstraction (StorageModule.forRoot wires
    // `STORAGE_PORT` to the cloudinary adapter in dev/prod and to the
    // fake adapter in tests) plus the §11 ownership-rule application
    // service that user/quiz modules consult before writing a
    // `public_id` (Phase 6 will plug into that gate).
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
    // Phase 5 #1 — observability module exposes `TracingProvider`
    // globally so HTTP/Redis/BullMQ/Drizzle wrappers can inject it.
    ObservabilityModule,
    // Phase 5 #3 — admin module exposes admin-only endpoints
    // (currently the audit log search).
    AdminModule,
    // Phase 2 — file scaffold only; controllers return 501. See
    // QUIZ_COIN_ECONOMY_DESIGN.md §16 for the implementation plan.
    CoinModule,
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
      // Phase 5 #1 — HTTP tracing interceptor. Runs after
      // `ResponseFormatInterceptor` so the span is closed
      // around the full response (including envelope
      // formatting) rather than just the inner handler.
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
