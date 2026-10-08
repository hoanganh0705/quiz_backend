import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtGuard } from './guards/jwt.guard';
import { WsThrottlerGuard } from './guards/ws-throttler.guard';
import {
  CommonExternalEventBus,
  EXTERNAL_EVENT_BUS,
  EXTERNAL_EVENT_BUS_PRODUCER_PORT,
  EXTERNAL_EVENT_BUS_CONSUMER_PORT,
} from './events/common-external-event-bus';
import { TransactionalContext, TRANSACTIONAL_CONTEXT } from './interceptors/transactional-context';
import { TransactionalInterceptor } from './interceptors/transactional.interceptor';
import { AuditLogService } from './audit/audit-log.service';
import { ID_GENERATOR, IdGenerator, IdGeneratorModule } from './utils/id-generator';
import { RetryQueueDrainScheduler } from './events/retry-queue-drain.scheduler';

@Global()
@Module({
  imports: [JwtModule.register({}), IdGeneratorModule],
  providers: [
    JwtGuard,
    WsThrottlerGuard,
    { provide: EXTERNAL_EVENT_BUS, useExisting: CommonExternalEventBus },
    { provide: EXTERNAL_EVENT_BUS_PRODUCER_PORT, useExisting: CommonExternalEventBus },
    { provide: EXTERNAL_EVENT_BUS_CONSUMER_PORT, useExisting: CommonExternalEventBus },
    CommonExternalEventBus,
    { provide: TRANSACTIONAL_CONTEXT, useExisting: TransactionalContext },
    TransactionalContext,
    AuditLogService,
    IdGenerator,
    { provide: ID_GENERATOR, useExisting: IdGenerator },
    RetryQueueDrainScheduler,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionalInterceptor,
    },
  ],
  exports: [
    JwtModule,
    JwtGuard,
    WsThrottlerGuard,
    EXTERNAL_EVENT_BUS,
    EXTERNAL_EVENT_BUS_PRODUCER_PORT,
    EXTERNAL_EVENT_BUS_CONSUMER_PORT,
    CommonExternalEventBus,
    TRANSACTIONAL_CONTEXT,
    TransactionalContext,
    AuditLogService,
    IdGenerator,
    ID_GENERATOR,
    RetryQueueDrainScheduler,
  ],
})
export class CommonModule {}
