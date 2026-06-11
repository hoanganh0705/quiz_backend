import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { AttemptModule } from '@/modules/attempt/attempt.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { NOTIFICATION_CHANNEL_SERVICE } from '@/modules/notification/domain/ports';
import { InstanceService } from './domain/instance.service';
import { InstanceController } from './transport/controller/instance.controller';
import { InstanceGateway } from './transport/gateway/instance.gateway';
import { InstanceResponseMapper } from './mappers/instance-response.mapper';
import { InstanceDomainExceptionFilter } from './transport/filters/instance-domain-exception.filter';
import { WsExceptionFilter } from './transport/filters/ws-exception.filter';
import { QUIZ_INSTANCE_REPOSITORY_PORT } from './domain/ports';
import { QuizInstanceRepository } from './infrastructure/repositories/quiz-instance.repository';
import { InstanceDomainEventBus } from './domain/events/instance-domain.event-bus';
import { INSTANCE_DOMAIN_EVENT_BUS } from './domain/events/instance-domain-event-bus.port';
import { InstanceAttemptEventBootstrapService } from './domain/events/instance-attempt-event-bootstrap.service';
import { InstanceApplicationService } from './application/instance.application.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AttemptModule),
    forwardRef(() => NotificationModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ?? '',
        signOptions: {
          expiresIn: '1d',
        },
      }),
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

    // Exception filters
    InstanceDomainExceptionFilter,
    WsExceptionFilter,

    // Repository
    QuizInstanceRepository,

    // Port bindings
    { provide: QUIZ_INSTANCE_REPOSITORY_PORT, useExisting: QuizInstanceRepository },
    { provide: INSTANCE_DOMAIN_EVENT_BUS, useExisting: InstanceDomainEventBus },
  ],
  controllers: [InstanceController],
  exports: [
    InstanceService,
    QUIZ_INSTANCE_REPOSITORY_PORT,
    INSTANCE_DOMAIN_EVENT_BUS,
  ],
})
export class InstanceModule {}
