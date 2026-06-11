import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtGuard } from './guards/jwt.guard';
import { CommonExternalEventBus, EXTERNAL_EVENT_BUS } from './events/common-external-event-bus';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from './interceptors/transactional-context';
import { TransactionalInterceptor } from './interceptors/transactional.interceptor';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    JwtGuard,
    { provide: EXTERNAL_EVENT_BUS, useExisting: CommonExternalEventBus },
    CommonExternalEventBus,
    { provide: TRANSACTIONAL_CONTEXT, useExisting: TransactionalContext },
    TransactionalContext,
    // Global interceptor: registered via APP_INTERCEPTOR so it applies to all
    // modules automatically (no need to add it to every module's providers).
    { provide: APP_INTERCEPTOR, useClass: TransactionalInterceptor },
  ],
  exports: [
    JwtModule,
    JwtGuard,
    EXTERNAL_EVENT_BUS,
    CommonExternalEventBus,
    TRANSACTIONAL_CONTEXT,
    TransactionalContext,
  ],
})
export class CommonModule {}
