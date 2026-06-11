import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import { AttemptCompletedEvent } from '@/modules/attempt/domain/events/attempt-domain.events';
import {
  INSTANCE_DOMAIN_EVENT_BUS,
  PlayerAttemptStartedEvent,
  PlayerXpEarnedEvent,
  PlayerFinishedEvent,
} from '../../domain/events';
import type { InstanceDomainEventBusPort } from '../../domain/events';
import { QUIZ_INSTANCE_REPOSITORY_PORT } from '../ports';
import type { QuizInstanceRepositoryPort } from '../ports';

/**
 * Subscribes to Attempt domain events to keep instance player state in sync.
 *
 * Handles:
 * - AttemptStartedEvent  → links attemptId, sets status to 'playing',
 *                          emits PlayerAttemptStartedEvent
 * - AttemptCompletedEvent → looks up attempt context (contextType/contextRefId),
 *                          sets status to 'finished', emits PlayerFinishedEvent
 *                          and PlayerXpEarnedEvent (authoritative xpEarned from the attempt)
 *
 * Registered in InstanceModule.onModuleInit.
 */
@Injectable()
export class InstanceAttemptEventBootstrapService implements OnModuleInit, OnModuleDestroy {
  private unsubscribeAttemptStarted: (() => void) | null = null;
  private unsubscribeAttemptCompleted: (() => void) | null = null;

  constructor(
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptEventBus: AttemptDomainEventBusPort,
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly instanceEventBus: InstanceDomainEventBusPort,
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @InjectPinoLogger(InstanceAttemptEventBootstrapService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribeAttemptStarted = this.attemptEventBus.subscribe(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.handleAttemptStarted.bind(this),
    );
    this.unsubscribeAttemptCompleted = this.attemptEventBus.subscribe(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.handleAttemptCompleted.bind(this),
    );

    this.logger.info({
      event: 'instance_attempt_event_handlers_subscribed',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribeAttemptStarted?.();
    this.unsubscribeAttemptCompleted?.();
    this.unsubscribeAttemptStarted = null;
    this.unsubscribeAttemptCompleted = null;
  }

  private handleAttemptStarted(event: unknown): void {
    // AttemptStartedEvent carries contextType/contextRefId — check these properties exist
    // before accessing them to avoid TS errors on the plain object from the event bus.
    if (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as Record<string, unknown>).eventType === 'attempt.started' &&
      'contextType' in event &&
      'contextRefId' in event &&
      'attemptId' in event &&
      'userId' in event &&
      'quizVersionId' in event
    ) {
      const e = event as unknown as {
        contextType: string;
        contextRefId: string | null;
        attemptId: string;
        userId: string;
        quizVersionId: string;
      };
      if (e.contextType === 'instance' && e.contextRefId) {
        void this.linkAttemptAndTransitionPlayer(e);
      }
    }
  }

  private handleAttemptCompleted(event: unknown): void {
    if (typeof event !== 'object' || event === null || !('eventType' in event)) return;
    if ((event as Record<string, unknown>).eventType !== 'attempt.completed') return;
    void this.handleAttemptFinished(event as AttemptCompletedEvent);
  }

  private async linkAttemptAndTransitionPlayer(event: {
    contextRefId: string | null;
    userId: string;
    attemptId: string;
    quizVersionId: string;
  }): Promise<void> {
    if (!event.contextRefId) return;
    const instanceId = event.contextRefId;

    try {
      await this.instanceRepository.linkAttemptToPlayer({
        instanceId,
        userId: event.userId,
        attemptId: event.attemptId,
        status: 'ready',
      });

      await this.instanceRepository.updatePlayerStatus({
        instanceId,
        userId: event.userId,
        status: 'playing',
      });

      const nowIso = new Date().toISOString();

      this.instanceEventBus.emitPlayerAttemptStarted(
        new PlayerAttemptStartedEvent(
          instanceId,
          event.userId,
          event.attemptId,
          event.quizVersionId,
          nowIso,
        ),
      );

      this.logger.debug({
        event: 'instance_player_attempt_started',
        attemptId: event.attemptId,
        userId: event.userId,
        instanceId,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_player_attempt_start_failed',
        attemptId: event.attemptId,
        userId: event.userId,
        instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleAttemptFinished(event: AttemptCompletedEvent): Promise<void> {
    // AttemptCompletedEvent does not carry contextType/contextRefId.
    // Look up the attempt to get the context.
    const attempt = await this.instanceRepository.getAttemptContextInfo(event.attemptId);

    if (!attempt || attempt.contextType !== 'instance' || !attempt.contextRefId) return;

    const instanceId = attempt.contextRefId;
    const nowIso = new Date().toISOString();

    try {
      await this.instanceRepository.updatePlayerStatus({
        instanceId,
        userId: event.userId,
        status: 'finished',
      });

      this.instanceEventBus.emitPlayerFinished(
        new PlayerFinishedEvent(instanceId, event.userId, nowIso),
      );

      if (event.xpEarned > 0) {
        this.instanceEventBus.emitPlayerXpEarned(
          new PlayerXpEarnedEvent(instanceId, event.userId, event.xpEarned, event.xpEarned, nowIso),
        );
      }

      this.logger.debug({
        event: 'instance_player_finished',
        attemptId: event.attemptId,
        userId: event.userId,
        instanceId,
        xpEarned: event.xpEarned,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_player_finish_failed',
        attemptId: event.attemptId,
        userId: event.userId,
        instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
