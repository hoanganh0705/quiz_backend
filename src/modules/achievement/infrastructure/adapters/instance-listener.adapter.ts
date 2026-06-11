/**
 * Instance Event Listener Adapter
 *
 * Listens to Instance domain events and triggers achievement evaluation.
 * This adapter bridges the Instance domain to the Achievement domain.
 *
 * Handles:
 * - `instance.created`      → evaluates "host first instance" badge rules
 * - `instance.player_finished` → evaluates "play N live quizzes" badge rules
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { INSTANCE_DOMAIN_EVENT_BUS } from '@/modules/instance/domain/events/instance-domain-event-bus.port';
import type { InstanceDomainEventBusPort } from '@/modules/instance/domain/events/instance-domain-event-bus.port';
import type {
  InstanceCreatedEvent,
  PlayerFinishedEvent,
} from '@/modules/instance/domain/events/instance-domain.events';

export interface InstanceDomainEvent {
  eventType: string;
  [key: string]: unknown;
}

@Injectable()
export class InstanceEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly instanceEventBus: InstanceDomainEventBusPort,
    @InjectPinoLogger(InstanceEventListenerAdapter.name)
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

  private isInstanceCreatedEvent(event: unknown): event is InstanceCreatedEvent & { eventType: 'instance.created'; timestamp: Date } {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as Record<string, unknown>).eventType === 'instance.created'
    );
  }

  private isPlayerFinishedEvent(event: unknown): event is PlayerFinishedEvent & { eventType: 'instance.player_finished'; timestamp: Date } {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as Record<string, unknown>).eventType === 'instance.player_finished'
    );
  }

  private async handleInstanceCreated(event: InstanceCreatedEvent): Promise<void> {
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
        userId: event.hostUserId,
        instanceId: event.instanceId,
        rulesEvaluated: results.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_instance_created_failed',
        userId: event.hostUserId,
        instanceId: event.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handlePlayerFinished(event: PlayerFinishedEvent): Promise<void> {
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
        userId: event.userId,
        instanceId: event.instanceId,
        rulesEvaluated: results.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_instance_player_finished_failed',
        userId: event.userId,
        instanceId: event.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
