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
export interface InstanceNotificationPort {
  notifyPlayerJoined(params: InstancePlayerJoinedParams): Promise<void>;
  notifyInstanceStarted(params: InstanceStartedParams): Promise<void>;
  notifyPlayerXpEarned(params: InstancePlayerXpEarnedParams): Promise<void>;
  notifyInstanceClosed(params: InstanceClosedParams): Promise<void>;
  notifyPlayerDisconnected(params: InstancePlayerDisconnectedParams): Promise<void>;
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
