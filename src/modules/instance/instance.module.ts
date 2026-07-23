import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { AttemptModule } from '@/modules/attempt/attempt.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { InstanceService } from './domain/instance.service';
import { InstanceController } from './transport/controller/instance.controller';
import { InstanceGateway } from './transport/gateway/instance.gateway';
import { InstanceResponseMapper } from './mappers/instance-response.mapper';
import { InstancePresenter } from './transport/presenters/instance.presenter';
import { WsExceptionFilter } from './transport/filters/ws-exception.filter';
import { QUIZ_INSTANCE_REPOSITORY_PORT, SOCKET_CONNECTION_REGISTRY_PORT } from './domain/ports';
import { QuizInstanceRepository } from './infrastructure/repositories/quiz-instance.repository';
import { RedisSocketConnectionRegistry } from './infrastructure/repositories/redis-socket-connection.registry';
import { InstanceDomainEventBus } from './domain/events/instance-domain.event-bus';
import { INSTANCE_DOMAIN_EVENT_BUS } from './domain/events/instance-domain-event-bus.port';
import { InstanceAttemptEventBootstrapService } from './domain/events/instance-attempt-event-bootstrap.service';
import { InstanceApplicationService } from './application/instance.application.service';
import { InstanceCountdownSchedulerService } from './infrastructure/scheduler/instance-countdown-scheduler.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AttemptModule),
    forwardRef(() => NotificationModule),
    // Phase 1 (Foundational Correctness) — `createInstance` now
    // resolves `quizId` → published version via `QuizRepositoryPort`.
    // Importing `QuizModule` exports the provider; the
    // `forwardRef` indirection keeps a future two-way dependency
    // (e.g. quiz hydration pulling instance metrics) cycle-safe.
    forwardRef(() => QuizModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.accessSecret');
        return {
          secret: secret ?? '',
          signOptions: {
            expiresIn: '1d',
          },
        };
      },
    }),
  ],
  providers: [
    // Domain
    InstanceService,

    // Application
    InstanceApplicationService,

    // Event Bus
    InstanceDomainEventBus,

    // Event Bootstrap (subscribes to AttemptStartedEvent, AttemptCompletedEvent)
    InstanceAttemptEventBootstrapService,

    // Gateway
    InstanceGateway,

    // Mapper
    InstanceResponseMapper,

    // Presenter
    InstancePresenter,

    // Exception filter (Phase 2: HTTP filter removed — global filter handles
    // InstanceDomainError. WS filter kept — handles auth/generic only).
    WsExceptionFilter,

    // Repository
    QuizInstanceRepository,

    // Phase 2 — countdown scheduler. Registered alongside the rest of
    // the domain/application providers so its `@Cron` is picked up by
    // the global `ScheduleModule` imported in `AppModule`.
    InstanceCountdownSchedulerService,

    // Phase 3 — cross-instance socketId → {instanceId, userId}
    // registry. Backed by Redis via the application's shared
    // `CacheProvider`, behind the `SocketConnectionRegistryPort`
    // port to keep the application service testable.
    RedisSocketConnectionRegistry,

    // Port bindings
    { provide: QUIZ_INSTANCE_REPOSITORY_PORT, useExisting: QuizInstanceRepository },
    { provide: INSTANCE_DOMAIN_EVENT_BUS, useExisting: InstanceDomainEventBus },
    { provide: SOCKET_CONNECTION_REGISTRY_PORT, useExisting: RedisSocketConnectionRegistry },
  ],
  controllers: [InstanceController],
  exports: [
    InstanceService,
    QUIZ_INSTANCE_REPOSITORY_PORT,
    INSTANCE_DOMAIN_EVENT_BUS,
    SOCKET_CONNECTION_REGISTRY_PORT,
  ],
})
export class InstanceModule {}
