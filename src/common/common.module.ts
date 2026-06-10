import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';
import { CommonExternalEventBus, EXTERNAL_EVENT_BUS } from './events/common-external-event-bus';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    JwtGuard,
    { provide: EXTERNAL_EVENT_BUS, useExisting: CommonExternalEventBus },
    CommonExternalEventBus,
  ],
  exports: [JwtModule, JwtGuard, EXTERNAL_EVENT_BUS, CommonExternalEventBus],
})
export class CommonModule {}
