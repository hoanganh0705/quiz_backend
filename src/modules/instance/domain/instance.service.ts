import { Inject, Injectable, Optional, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QUIZ_INSTANCE_REPOSITORY_PORT } from './ports';
import type { QuizInstanceRepositoryPort } from './ports';
import { INSTANCE_DOMAIN_EVENT_BUS } from './events';
import type { InstanceDomainEventBusPort } from './events';
import {
  INSTANCE_NOT_FOUND_MESSAGE,
  INSTANCE_NOT_HOST_MESSAGE,
  INSTANCE_NOT_OPEN_MESSAGE,
  INSTANCE_FULL_MESSAGE,
  INSTANCE_ALREADY_STARTED_MESSAGE,
  INSTANCE_ALREADY_CLOSED_MESSAGE,
} from '../instance.constants';
import {
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  InstanceFullError,
  InstanceAlreadyStartedError,
  InstanceAlreadyClosedError,
} from './errors';
import {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
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
  ) {}

  async createInstance(params: {
    quizVersionId: string;
    user: JwtPayload;
    maxPlayers: number | null;
  }): Promise<{ instanceId: string; hostUserId: string }> {
    const nowIso = new Date().toISOString();

    const result = await this.instanceRepository.createInstanceWithHost({
      quizVersionId: params.quizVersionId,
      hostUserId: params.user.sub,
      maxPlayers: params.maxPlayers,
      nowIso,
    });

    this.logger.info({
      event: 'instance_created',
      instanceId: result.instanceId,
      hostUserId: params.user.sub,
      quizVersionId: params.quizVersionId,
    });

    this.eventBus.emitInstanceCreated(
      new InstanceCreatedEvent(
        result.instanceId,
        params.quizVersionId,
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
        throw new InstanceFullError(INSTANCE_FULL_MESSAGE);
      }

      this.logger.info({
        event: 'player_joined',
        instanceId,
        userId: user.sub,
      });

      this.eventBus.emitPlayerJoined(
        new PlayerJoinedEvent(
          instanceId,
          user.sub,
          await this.instanceRepository.countPlayers(instanceId),
          nowIso,
        ),
      );

      const totalPlayers = await this.instanceRepository.countPlayers(instanceId);
      void this.notifyHostPlayerJoined({
        instanceId,
        hostUserId: instance.hostUserId,
        joiningUserId: user.sub,
        totalPlayers,
      });

      return { message: 'Joined the instance successfully' };
    } catch (error) {
      if (error instanceof Error && error.message === 'INSTANCE_FULL') {
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

    if (instance.status !== 'open') {
      throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
    }

    await this.instanceRepository.updateInstanceStatus({
      instanceId,
      status: 'running',
      startedAt: nowIso,
      nowIso,
    });

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

    if (instance.status === 'closed' || instance.status === 'finished') {
      throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
    }

    await this.instanceRepository.updateInstanceStatus({
      instanceId,
      status: 'closed',
      closedAt: nowIso,
      nowIso,
    });

    this.logger.info({
      event: 'instance_closed',
      instanceId,
      userId: user.sub,
    });

    this.eventBus.emitInstanceClosed(new InstanceClosedEvent(instanceId, user.sub, nowIso));

    return { message: 'Instance closed' };
  }

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
    };
  }): Promise<{
    rows: import('./ports').QuizInstanceListRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const limit = params.limit ?? 20;
    const cursorValue = typeof params.cursor === 'string' ? params.cursor : undefined;

    const cursor: import('./ports').InstanceCursorPayload | null = cursorValue
      ? (JSON.parse(
          Buffer.from(cursorValue, 'base64').toString('utf-8'),
        ) as import('./ports').InstanceCursorPayload)
      : null;

    const rows = await this.instanceRepository.listInstances({
      limit,
      cursor,
      filters: params.filters as
        | { status?: 'open' | 'running' | 'closed' | 'finished'; difficulty?: string }
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
                createdAt: lastItem.createdAt,
                instanceId: lastItem.instanceId,
              }),
            ).toString('base64')
          : null,
    };
  }

  async listInstancePlayers(
    instanceId: string,
  ): Promise<{ items: import('./ports').InstancePlayerWithProfile[]; total: number }> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    const players = await this.instanceRepository.listPlayersWithProfile({ instanceId });

    return { items: players, total: players.length };
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
