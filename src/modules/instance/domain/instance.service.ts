import { Inject, Injectable, Optional, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { decodeInstanceCursor } from '@/common/utils/cursor.util';
import { QUIZ_INSTANCE_REPOSITORY_PORT } from './ports';
import type { QuizInstanceRepositoryPort, InstanceCursorPayload } from './ports';
import { INSTANCE_DOMAIN_EVENT_BUS } from './events';
import type { InstanceDomainEventBusPort } from './events';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import type { QuizRepositoryPort } from '@/modules/quiz/domain/ports';
import { QuizNotFoundError, QuizVersionNotFoundError } from '@/modules/quiz/domain/errors';
import {
  INSTANCE_NOT_FOUND_MESSAGE,
  INSTANCE_NOT_HOST_MESSAGE,
  INSTANCE_NOT_OPEN_MESSAGE,
  INSTANCE_FULL_MESSAGE,
  INSTANCE_ALREADY_STARTED_MESSAGE,
  INSTANCE_ALREADY_CLOSED_MESSAGE,
  INSTANCE_ALREADY_FINISHED_MESSAGE,
  INSTANCE_NOT_IN_COUNTDOWN_MESSAGE,
  INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE,
  MIN_PLAYERS_NOT_MET_MESSAGE,
} from '../instance.constants';
import {
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  InstanceFullError,
  InstanceFullCapacityError,
  InstanceAlreadyStartedError,
  InstanceAlreadyClosedError,
  InstanceAlreadyFinishedError,
  PlayerAlreadyJoinedError,
  InstanceOptimisticLockError,
  MinPlayersNotMetError,
  InstanceNotInCountdownError,
  InstanceCountdownAlreadyStartedError,
} from './errors';
import {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
} from './events';
import {
  INSTANCE_NOTIFICATION_PORT,
  type InstanceNotificationPort,
} from '@/modules/notification/domain/ports';

@Injectable()
export class InstanceService {
  constructor(
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly eventBus: InstanceDomainEventBusPort,
    @InjectPinoLogger(InstanceService.name)
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(forwardRef(() => INSTANCE_NOTIFICATION_PORT))
    private readonly instanceNotifications?: InstanceNotificationPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository?: QuizRepositoryPort,
  ) {}

  async createInstance(params: {
    quizId: string;
    user: JwtPayload;
    maxPlayers: number | null;
  }): Promise<{ instanceId: string; hostUserId: string }> {
    if (!this.quizRepository) {
      throw new Error('QuizRepositoryPort is not configured for instance creation');
    }
    const quiz = await this.quizRepository.getQuizWithPublishedVersionById(params.quizId);
    if (!quiz) {
      throw new QuizNotFoundError();
    }
    if (!quiz.publishedVersionId) {
      throw new QuizVersionNotFoundError();
    }

    const nowIso = new Date().toISOString();
    const quizVersionId = quiz.publishedVersionId;

    const result = await this.instanceRepository.createInstanceWithHost({
      quizVersionId,
      hostUserId: params.user.sub,
      maxPlayers: params.maxPlayers,
      nowIso,
    });

    this.logger.info({
      event: 'instance_created',
      instanceId: result.instanceId,
      hostUserId: params.user.sub,
      quizId: params.quizId,
      quizVersionId,
    });

    this.eventBus.emitInstanceCreated(
      new InstanceCreatedEvent(
        result.instanceId,
        quizVersionId,
        params.user.sub,
        params.maxPlayers,
        nowIso,
      ),
    );

    return { instanceId: result.instanceId, hostUserId: params.user.sub };
  }

  async getInstanceById(instanceId: string): Promise<import('./ports').QuizInstanceDetailRow> {
    const instance = await this.instanceRepository.getInstanceDetailById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return instance;
  }

  async joinInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.status !== 'open') {
      throw new InstanceNotOpenError(INSTANCE_NOT_OPEN_MESSAGE);
    }

    try {
      const result = await this.instanceRepository.joinInstanceAtomic({
        instanceId,
        userId: user.sub,
        maxPlayers: instance.maxPlayers,
        nowIso,
      });

      if (!result.joined) {
        throw new PlayerAlreadyJoinedError();
      }

      this.logger.info({
        event: 'player_joined',
        instanceId,
        userId: user.sub,
      });

      const totalPlayers = await this.instanceRepository.countPlayers(instanceId);

      this.eventBus.emitPlayerJoined(
        new PlayerJoinedEvent(instanceId, user.sub, totalPlayers, nowIso),
      );

      void this.notifyHostPlayerJoined({
        instanceId,
        hostUserId: instance.hostUserId,
        joiningUserId: user.sub,
        totalPlayers,
      });

      return { message: 'Joined the instance successfully' };
    } catch (error) {
      if (error instanceof InstanceFullCapacityError) {
        throw new InstanceFullError(INSTANCE_FULL_MESSAGE);
      }
      throw error;
    }
  }

  async startInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    if (instance.status === 'open') {
      throw new InstanceNotInCountdownError(INSTANCE_NOT_IN_COUNTDOWN_MESSAGE);
    }
    if (instance.status === 'running') {
      throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
    }
    if (instance.status === 'closed' || instance.status === 'finished') {
      throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
    }

    const totalPlayers = await this.instanceRepository.countPlayers(instanceId);
    if (totalPlayers < InstanceService.MIN_PLAYERS_PER_INSTANCE) {
      throw new MinPlayersNotMetError(MIN_PLAYERS_NOT_MET_MESSAGE);
    }

    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'running',
        startedAt: nowIso,
        countdownStartedAt: null,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest?.status === 'running') {
          throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
        }
        if (latest?.status === 'closed' || latest?.status === 'finished') {
          throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_started',
      instanceId,
      userId: user.sub,
    });

    this.eventBus.emitInstanceStarted(new InstanceStartedEvent(instanceId, user.sub, nowIso));

    return { message: 'Instance started' };
  }

  async closeInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    if (instance.status === 'closed') {
      throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
    }
    if (instance.status === 'finished') {
      throw new InstanceAlreadyFinishedError(INSTANCE_ALREADY_FINISHED_MESSAGE);
    }

    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'closed',
        closedAt: nowIso,
        countdownStartedAt: null,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest?.status === 'closed') {
          throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
        }
        if (latest?.status === 'finished') {
          throw new InstanceAlreadyFinishedError(INSTANCE_ALREADY_FINISHED_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_closed',
      instanceId,
      userId: user.sub,
    });

    this.eventBus.emitInstanceClosed(new InstanceClosedEvent(instanceId, user.sub, nowIso));

    if (instance.status === 'countdown') {
      this.eventBus.emitCountdownCancelled(
        new CountdownCancelledEvent(instanceId, user.sub, 'instance_closed', nowIso),
      );
    }

    return { message: 'Instance closed' };
  }

  static readonly MIN_PLAYERS_PER_INSTANCE = 2;

  async startCountdown(
    instanceId: string,
    user: JwtPayload,
  ): Promise<{
    instanceId: string;
    status: 'countdown';
    countdownStartedAt: string;
    countdownEndsAt: string;
  }> {
    const nowIso = new Date().toISOString();
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }
    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    if (instance.status === 'countdown') {
      throw new InstanceCountdownAlreadyStartedError(INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE);
    }
    if (instance.status !== 'open') {
      throw new InstanceNotOpenError(INSTANCE_NOT_OPEN_MESSAGE);
    }

    const countdownStartedAt = nowIso;
    const countdownEndsAt = new Date(
      new Date(countdownStartedAt).getTime() + InstanceService.COUNTDOWN_DURATION_MS,
    ).toISOString();

    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'countdown',
        countdownStartedAt,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest?.status === 'countdown') {
          throw new InstanceCountdownAlreadyStartedError(
            INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE,
          );
        }
        if (latest?.status === 'running') {
          throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
        }
        if (latest?.status === 'closed' || latest?.status === 'finished') {
          throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_countdown_started',
      instanceId,
      userId: user.sub,
      countdownStartedAt,
      countdownEndsAt,
    });

    this.eventBus.emitCountdownStarted(
      new CountdownStartedEvent(instanceId, user.sub, countdownStartedAt, countdownEndsAt, nowIso),
    );

    return { instanceId, status: 'countdown', countdownStartedAt, countdownEndsAt };
  }

  async cancelCountdown(
    instanceId: string,
    user: JwtPayload,
    reason: 'host_cancelled' | 'host_disconnected' = 'host_cancelled',
  ): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }
    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }
    if (instance.status !== 'countdown') {
      throw new InstanceNotInCountdownError(INSTANCE_NOT_IN_COUNTDOWN_MESSAGE);
    }

    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'open',
        countdownStartedAt: null,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest && latest.status !== 'countdown') {
          throw new InstanceNotInCountdownError(INSTANCE_NOT_IN_COUNTDOWN_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_countdown_cancelled',
      instanceId,
      userId: user.sub,
      reason,
    });

    this.eventBus.emitCountdownCancelled(
      new CountdownCancelledEvent(instanceId, user.sub, reason, nowIso),
    );

    return { message: 'Countdown cancelled' };
  }
  async completeCountdownByScheduler(params: {
    instanceId: string;
    expectedVersion: number;
  }): Promise<
    | { completed: true; status: 'running'; startedAt: string }
    | { completed: false; reason: 'min_players_not_met' | 'state_changed' | 'lost_lock' }
  > {
    const nowIso = new Date().toISOString();
    const instance = await this.instanceRepository.getInstanceById(params.instanceId);

    if (!instance || instance.status !== 'countdown') {
      return { completed: false, reason: 'state_changed' };
    }

    const totalPlayers = await this.instanceRepository.countPlayers(params.instanceId);
    if (totalPlayers < InstanceService.MIN_PLAYERS_PER_INSTANCE) {
      try {
        await this.instanceRepository.updateInstanceStatus({
          instanceId: params.instanceId,
          status: 'open',
          countdownStartedAt: null,
          nowIso,
          expectedVersion: params.expectedVersion,
        });
      } catch (error) {
        if (error instanceof InstanceOptimisticLockError) {
          return { completed: false, reason: 'lost_lock' };
        }
        throw error;
      }

      this.logger.info({
        event: 'instance_countdown_auto_cancelled',
        instanceId: params.instanceId,
        reason: 'min_players_not_met',
        totalPlayers,
      });

      this.eventBus.emitCountdownCancelled(
        new CountdownCancelledEvent(
          params.instanceId,
          instance.hostUserId,
          'host_disconnected',
          nowIso,
        ),
      );

      return { completed: false, reason: 'min_players_not_met' };
    }

    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId: params.instanceId,
        status: 'running',
        startedAt: nowIso,
        countdownStartedAt: null,
        nowIso,
        expectedVersion: params.expectedVersion,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        return { completed: false, reason: 'lost_lock' };
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_countdown_completed',
      instanceId: params.instanceId,
      startedAt: nowIso,
    });

    this.eventBus.emitCountdownCompleted(
      new CountdownCompletedEvent(params.instanceId, nowIso, nowIso),
    );
    this.eventBus.emitInstanceStarted(
      new InstanceStartedEvent(params.instanceId, instance.hostUserId, nowIso),
    );

    return { completed: true, status: 'running', startedAt: nowIso };
  }

  static readonly COUNTDOWN_DURATION_MS = 5_000;

  async getLeaderboard(params: {
    instanceId: string;
    limit: number;
    cursor?: import('./ports').LeaderboardCursorPayload | null;
  }): Promise<{ items: import('./ports').InstanceLeaderboardEntry[]; hasNextPage: boolean }> {
    const instance = await this.instanceRepository.getInstanceById(params.instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return this.instanceRepository.getLeaderboard(params);
  }

  async getInstancePlayers(instanceId: string): Promise<import('./ports').QuizInstancePlayerRow[]> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return this.instanceRepository.listPlayers(instanceId);
  }

  async isPlayerInInstance(instanceId: string, userId: string): Promise<boolean> {
    const player = await this.instanceRepository.getPlayer(instanceId, userId);
    return player !== null;
  }

  async countPlayers(instanceId: string): Promise<number> {
    return this.instanceRepository.countPlayers(instanceId);
  }

  async getPlayerByUserAndInstance(params: {
    instanceId: string;
    userId: string;
  }): Promise<import('./ports').QuizInstancePlayerRow | null> {
    return this.instanceRepository.getPlayerByUserAndInstance(params);
  }

  async isHost(instanceId: string, userId: string): Promise<boolean> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);
    return instance?.hostUserId === userId;
  }

  async listInstances(params: {
    limit: number;
    cursor?: string | null;
    filters?: {
      status?: string;
      difficulty?: string;
      quizId?: string;
      creatorId?: string;
    };
  }): Promise<{
    rows: import('./ports').QuizInstanceListRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const limit = params.limit ?? 20;
    const cursorValue = typeof params.cursor === 'string' ? params.cursor : undefined;

    if (params.filters?.status) {
      const validStatuses = ['open', 'countdown', 'running', 'closed', 'finished'] as const;
      if (!validStatuses.includes(params.filters.status as (typeof validStatuses)[number])) {
        throw new Error(
          `Invalid status filter: '${params.filters.status}'. Valid values: ${validStatuses.join(', ')}`,
        );
      }
    }

    const cursor: InstanceCursorPayload | null = cursorValue
      ? decodeInstanceCursor(cursorValue)
      : null;

    const rows = await this.instanceRepository.listInstances({
      limit,
      cursor,
      filters: params.filters as
        | {
            status?: 'open' | 'countdown' | 'running' | 'closed' | 'finished';
            difficulty?: string;
            quizId?: string;
            creatorId?: string;
          }
        | undefined,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      rows: items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? Buffer.from(
              JSON.stringify({
                createdAt: new Date(lastItem.createdAt).toISOString(),
                instanceId: lastItem.instanceId,
              }),
            ).toString('base64url')
          : null,
    };
  }

  async listInstancePlayers(
    instanceId: string,
    params: {
      limit: number;
      cursor?: { joinedAt: string; instancePlayerId: string } | null;
    },
  ): Promise<{
    items: import('./ports').InstancePlayerWithProfile[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    const { items, hasNextPage } = await this.instanceRepository.listPlayersWithProfile({
      instanceId,
      limit: params.limit,
      cursor: params.cursor ?? null,
    });

    const lastItem = items.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(
            JSON.stringify({
              joinedAt: new Date(lastItem.joinedAt).toISOString(),
              instancePlayerId: lastItem.instancePlayerId,
            }),
            'utf8',
          ).toString('base64url')
        : null;

    return { items, hasNextPage, nextCursor };
  }

  async notifyHostPlayerJoined(params: {
    instanceId: string;
    hostUserId: string;
    joiningUserId: string;
    totalPlayers: number;
  }): Promise<void> {
    await this.sendHostNotification({
      userId: params.hostUserId,
      title: 'Player Joined',
      body: `A player joined your quiz instance (${params.totalPlayers} player${params.totalPlayers !== 1 ? 's' : ''} online).`,
      metadata: {
        instanceId: params.instanceId,
        joiningUserId: params.joiningUserId,
        event: 'player_joined',
        errorCode: 'PLAYER_JOINED',
      },
    });
  }

  async notifyHostPlayerDisconnected(params: {
    instanceId: string;
    hostUserId: string;
    leavingUserId: string;
    totalPlayers: number;
  }): Promise<void> {
    await this.sendHostNotification({
      userId: params.hostUserId,
      title: 'Player Left',
      body: `A player left your quiz instance (${params.totalPlayers} player${params.totalPlayers !== 1 ? 's' : ''} online).`,
      metadata: {
        instanceId: params.instanceId,
        leavingUserId: params.leavingUserId,
        event: 'player_disconnected',
        errorCode: 'PLAYER_DISCONNECTED',
      },
    });
  }

  private async sendHostNotification(params: {
    userId: string;
    title: string;
    body: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (!this.instanceNotifications) {
      this.logger.warn({
        event: 'instance_notification_port_unavailable',
        message: 'INSTANCE_NOTIFICATION_PORT not injected; skipping notification',
      });
      return;
    }

    try {
      await this.instanceNotifications.notifyHostSystemAnnouncement({
        userId: params.userId,
        title: params.title,
        body: params.body,
        metadata: params.metadata,
      });

      this.logger.debug({
        event: 'host_notification_sent',
        userId: params.userId,
        title: params.title,
      });
    } catch (error) {
      this.logger.error({
        event: 'host_notification_failed',
        userId: params.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
