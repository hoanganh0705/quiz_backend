import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
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
  InstanceStartedEvent,
  InstanceClosedEvent,
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
} from './instance-domain.events';

/**
 * Simple domain event bus for Instance aggregate events.
 *
 * This is a lightweight in-process event bus using the observer pattern.
 * Events are dispatched synchronously within the same request lifecycle.
 *
 * Use `emit()` to dispatch events and `subscribe()` to register handlers.
 */
@Injectable()
export class InstanceDomainEventBus implements InstanceDomainEventBusPort {
  private handlers: InstanceEventHandler[] = [];

  constructor(
    @InjectPinoLogger(InstanceDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: InstanceEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: unknown): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'instance_event_handler_error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  emitInstanceCreated(event: InstanceCreatedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.created',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
    });
    this.emit(event);
  }

  emitPlayerJoined(event: PlayerJoinedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_joined',
      instanceId: event.instanceId,
      userId: event.userId,
    });
    this.emit(event);
  }

  emitPlayerAttemptStarted(event: PlayerAttemptStartedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_attempt_started',
      instanceId: event.instanceId,
      userId: event.userId,
      attemptId: event.attemptId,
    });
    this.emit(event);
  }

  emitPlayerXpEarned(event: PlayerXpEarnedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_xp_earned',
      instanceId: event.instanceId,
      userId: event.userId,
      xpEarned: event.xpEarned,
    });
    this.emit(event);
  }

  emitPlayerFinished(event: PlayerFinishedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_finished',
      instanceId: event.instanceId,
      userId: event.userId,
    });
    this.emit(event);
  }

  emitPlayerDisconnected(event: PlayerDisconnectedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.player_disconnected',
      instanceId: event.instanceId,
      userId: event.userId,
      socketId: event.socketId,
    });
    this.emit(event);
  }

  emitInstanceStarted(event: InstanceStartedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.started',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
    });
    this.emit(event);
  }

  emitInstanceClosed(event: InstanceClosedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.closed',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
    });
    this.emit(event);
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
    this.emit(event);
  }

  emitCountdownCancelled(event: CountdownCancelledEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.countdown_cancelled',
      instanceId: event.instanceId,
      hostUserId: event.hostUserId,
      reason: event.reason,
    });
    this.emit(event);
  }

  emitCountdownCompleted(event: CountdownCompletedEvent): void {
    this.logger.debug({
      event: 'instance_event_emitted',
      eventType: 'instance.countdown_completed',
      instanceId: event.instanceId,
      startedAt: event.startedAt,
    });
    this.emit(event);
  }
}

export { INSTANCE_DOMAIN_EVENT_BUS };
