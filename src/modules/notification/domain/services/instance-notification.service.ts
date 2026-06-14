/**
 * Instance Notification Service
 *
 * Composes and sends instance-related notifications for real-time multiplayer quiz sessions.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

export interface InstancePlayerJoinedParams {
  hostUserId: string;
  instanceId: string;
  playerUserId: string;
  playerName: string;
  totalPlayers: number;
}

export interface InstanceStartedParams {
  instanceId: string;
  hostUserId: string;
  playerIds: string[];
}

export interface InstancePlayerXpEarnedParams {
  userId: string;
  instanceId: string;
  xpEarned: number;
  newAllTimeXp: number;
}

export interface InstanceClosedParams {
  instanceId: string;
  hostUserId: string;
  playerIds: string[];
}

export interface InstancePlayerDisconnectedParams {
  userId: string;
  instanceId: string;
  socketId: string;
}

/**
 * Port interface exposed to the Instance module via INSTANCE_NOTIFICATION_PORT.
 */
export interface InstanceNotificationPort {
  notifyPlayerJoined(params: InstancePlayerJoinedParams): Promise<void>;
  notifyInstanceStarted(params: InstanceStartedParams): Promise<void>;
  notifyPlayerXpEarned(params: InstancePlayerXpEarnedParams): Promise<void>;
  notifyInstanceClosed(params: InstanceClosedParams): Promise<void>;
  notifyPlayerDisconnected(params: InstancePlayerDisconnectedParams): Promise<void>;
  /**
   * Generic host-side system announcement. Used by the Instance service for
   * low-level system messages (e.g. host re-engagement) that do not have a
   * dedicated event type.
   */
  notifyHostSystemAnnouncement(params: {
    userId: string;
    title: string;
    body: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

@Injectable()
export class InstanceNotificationService implements InstanceNotificationPort {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(InstanceNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Notify the host when a player joins the instance.
   */
  async notifyPlayerJoined(params: InstancePlayerJoinedParams): Promise<void> {
    const title = 'Player Joined';
    const body = `${params.playerName} joined your quiz session (${params.totalPlayers} players)`;

    await this.channelService.send({
      userId: params.hostUserId,
      type: 'instance_player_joined',
      title,
      body,
      metadata: {
        instanceId: params.instanceId,
        playerUserId: params.playerUserId,
        playerName: params.playerName,
        totalPlayers: params.totalPlayers,
      },
    });

    this.logger.info({
      event: 'instance_player_joined_notification_sent',
      hostUserId: params.hostUserId,
      playerUserId: params.playerUserId,
      instanceId: params.instanceId,
    });
  }

  /**
   * Notify all players when the instance starts.
   */
  async notifyInstanceStarted(params: InstanceStartedParams): Promise<void> {
    const body = 'The quiz session has started!';

    await Promise.all(
      params.playerIds.map((userId) =>
        this.channelService.send({
          userId,
          type: 'instance_started',
          title: 'Quiz Session Started',
          body,
          metadata: {
            instanceId: params.instanceId,
            hostUserId: params.hostUserId,
          },
        }),
      ),
    );

    this.logger.info({
      event: 'instance_started_notification_sent',
      instanceId: params.instanceId,
      playerCount: params.playerIds.length,
    });
  }

  /**
   * Notify a player of their XP earned during the instance (real-time popup).
   */
  async notifyPlayerXpEarned(params: InstancePlayerXpEarnedParams): Promise<void> {
    const title = '+XP Earned!';
    const body = `You earned ${params.xpEarned} XP! Total: ${params.newAllTimeXp}`;

    await this.channelService.send({
      userId: params.userId,
      type: 'instance_xp_earned',
      title,
      body,
      metadata: {
        instanceId: params.instanceId,
        xpEarned: params.xpEarned,
        newAllTimeXp: params.newAllTimeXp,
      },
    });

    this.logger.debug({
      event: 'instance_xp_earned_notification_sent',
      userId: params.userId,
      xpEarned: params.xpEarned,
      instanceId: params.instanceId,
    });
  }

  /**
   * Notify all players when the instance is closed.
   */
  async notifyInstanceClosed(params: InstanceClosedParams): Promise<void> {
    const body = 'The quiz session has ended.';

    await Promise.all(
      params.playerIds.map((userId) =>
        this.channelService.send({
          userId,
          type: 'instance_closed',
          title: 'Quiz Session Ended',
          body,
          metadata: {
            instanceId: params.instanceId,
            hostUserId: params.hostUserId,
          },
        }),
      ),
    );

    this.logger.info({
      event: 'instance_closed_notification_sent',
      instanceId: params.instanceId,
      playerCount: params.playerIds.length,
    });
  }

  /**
   * Notify a player when they disconnect from a running instance.
   */
  async notifyPlayerDisconnected(params: InstancePlayerDisconnectedParams): Promise<void> {
    const title = 'Connection Lost';
    const body = 'You have been disconnected from the quiz session. Please reconnect.';

    await this.channelService.send({
      userId: params.userId,
      type: 'instance_player_disconnected',
      title,
      body,
      metadata: {
        instanceId: params.instanceId,
        socketId: params.socketId,
      },
    });

    this.logger.info({
      event: 'instance_player_disconnected_notification_sent',
      userId: params.userId,
      instanceId: params.instanceId,
    });
  }

  /**
   * Generic host-side system announcement (in-app only). Keeps low-level
   * system messages inside the Notification module's surface area.
   */
  async notifyHostSystemAnnouncement(params: {
    userId: string;
    title: string;
    body: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.channelService.send({
      userId: params.userId,
      type: 'system_announcement',
      title: params.title,
      body: params.body,
      metadata: params.metadata,
      channels: ['in_app'],
    });
  }
}
