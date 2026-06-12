/**
 * Instance Event Listener Adapter
 *
 * Listens to Instance domain events and triggers achievement evaluation.
 * This adapter bridges the Instance domain to the Achievement domain.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createCorrelationId } from '@/common/interceptors/correlation-id';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { INSTANCE_DOMAIN_EVENT_BUS } from '@/modules/instance/domain/events/instance-domain-event-bus.port';
import type { InstanceDomainEventBusPort } from '@/modules/instance/domain/events/instance-domain-event-bus.port';
import type {
  InstanceCreatedEvent,
  PlayerFinishedEvent,
} from '@/modules/instance/domain/events/instance-domain.events';

@Injectable()
export class AchievementInstanceEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly instanceEventBus: InstanceDomainEventBusPort,
    @InjectPinoLogger(AchievementInstanceEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.instanceEventBus.subscribe((event: unknown) => {
      if (this.isInstanceCreatedEvent(event)) {
        this.handleInstanceCreated(event);
      } else if (this.isPlayerFinishedEvent(event)) {
        this.handlePlayerFinished(event);
      }
    });

    this.logger.info({
      event: 'achievement_instance_listener_subscribed',
    });
  }

  private isInstanceCreatedEvent(event: unknown): event is InstanceCreatedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'instance.created'
    );
  }

  private isPlayerFinishedEvent(event: unknown): event is PlayerFinishedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'instance.player_finished'
    );
  }

  private async handleInstanceCreated(event: InstanceCreatedEvent): Promise<void> {
    const correlationId = createCorrelationId();

    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.hostUserId,
        eventType: 'instance.created',
        eventData: {
          instanceId: event.instanceId,
          quizVersionId: event.quizVersionId,
          maxPlayers: event.maxPlayers,
        },
      });

      this.logger.debug({
        event: 'achievement_instance_created_evaluated',
        correlationId,
        userId: event.hostUserId,
        instanceId: event.instanceId,
        rulesEvaluated: results.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_instance_created_failed',
        correlationId,
        userId: event.hostUserId,
        instanceId: event.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handlePlayerFinished(event: PlayerFinishedEvent): Promise<void> {
    const correlationId = createCorrelationId();

    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'instance.player_finished',
        eventData: {
          instanceId: event.instanceId,
        },
      });

      this.logger.debug({
        event: 'achievement_instance_player_finished_evaluated',
        correlationId,
        userId: event.userId,
        instanceId: event.instanceId,
        rulesEvaluated: results.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_instance_player_finished_failed',
        correlationId,
        userId: event.userId,
        instanceId: event.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
