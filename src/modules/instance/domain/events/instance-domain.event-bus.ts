import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import {
  type InstanceDomainEventBusPort,
  type InstanceEventHandler,
  INSTANCE_DOMAIN_EVENT_BUS,
} from './instance-domain-event-bus.port';
import {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  PlayerAttemptStartedEvent,
  PlayerXpEarnedEvent,
  PlayerFinishedEvent,
  PlayerDisconnectedEvent,
  PlayerAnsweredEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
} from './instance-domain.events';

@Injectable()
export class InstanceDomainEventBus
  extends BaseDomainEventBus<unknown>
  implements InstanceDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(InstanceDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'instance_event' });
  }

  subscribe(handler: InstanceEventHandler): () => void {
    return super.subscribe(handler as never);
  }

  emitInstanceCreated(event: InstanceCreatedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.created',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
    });
    this.dispatch(event);
  }

  emitPlayerJoined(event: PlayerJoinedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_joined',
      instanceId: event.instanceId,
      userId: event.userId,
    });
    this.dispatch(event);
  }

  emitPlayerAttemptStarted(event: PlayerAttemptStartedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_attempt_started',
      instanceId: event.instanceId,
      userId: event.userId,
      attemptId: event.attemptId,
    });
    this.dispatch(event);
  }

  emitPlayerXpEarned(event: PlayerXpEarnedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_xp_earned',
      instanceId: event.instanceId,
      userId: event.userId,
      xpEarned: event.xpEarned,
    });
    this.dispatch(event);
  }

  emitPlayerFinished(event: PlayerFinishedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_finished',
      instanceId: event.instanceId,
      userId: event.userId,
    });
    this.dispatch(event);
  }

  emitPlayerDisconnected(event: PlayerDisconnectedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_disconnected',
      instanceId: event.instanceId,
      userId: event.userId,
      socketId: event.socketId,
    });
    this.dispatch(event);
  }

  emitPlayerAnswered(event: PlayerAnsweredEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_answered',
      instanceId: event.instanceId,
      userId: event.userId,
      questionId: event.questionId,
    });
    this.dispatch(event);
  }

  emitInstanceStarted(event: InstanceStartedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.started',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
    });
    this.dispatch(event);
  }

  emitInstanceClosed(event: InstanceClosedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.closed',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
    });
    this.dispatch(event);
  }

  emitCountdownStarted(event: CountdownStartedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.countdown_started',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
      countdownStartedAt: event.countdownStartedAt,
      countdownEndsAt: event.countdownEndsAt,
    });
    this.dispatch(event);
  }

  emitCountdownCancelled(event: CountdownCancelledEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.countdown_cancelled',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
      reason: event.reason,
    });
    this.dispatch(event);
  }

  emitCountdownCompleted(event: CountdownCompletedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.countdown_completed',
      startedAt: event.startedAt,
    });
    this.dispatch(event);
  }
}

export { INSTANCE_DOMAIN_EVENT_BUS };
