/**
 * Tournament Notification Service
 *
 * Composes and sends tournament-related notifications.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

export interface TournamentInviteParams {
  userId: string;
  tournamentId: string;
  tournamentTitle: string;
  inviterName: string;
  expiresAt: string;
}

export interface TournamentJoinedParams {
  userId: string;
  tournamentId: string;
  tournamentTitle: string;
}

export interface TournamentStartingParams {
  userId: string;
  tournamentId: string;
  tournamentTitle: string;
  startsAt: string;
}

export interface TournamentCompletedParams {
  userId: string;
  tournamentId: string;
  tournamentTitle: string;
  rank: number;
  totalParticipants: number;
}

export interface TournamentWonParams {
  userId: string;
  tournamentId: string;
  tournamentTitle: string;
  prize?: string;
}

/**
 * Port interface exposed to the Tournament module via TOURNAMENT_NOTIFICATION_PORT.
 */
export interface TournamentNotificationPort {
  notifyTournamentInvite(params: TournamentInviteParams): Promise<void>;
  notifyTournamentJoined(params: TournamentJoinedParams): Promise<void>;
  notifyTournamentStarting(params: TournamentStartingParams): Promise<void>;
  notifyTournamentCompleted(params: TournamentCompletedParams): Promise<void>;
  notifyTournamentWon(params: TournamentWonParams): Promise<void>;
}

@Injectable()
export class TournamentNotificationService implements TournamentNotificationPort {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(TournamentNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Send a tournament invite notification.
   */
  async notifyTournamentInvite(params: TournamentInviteParams): Promise<void> {
    const title = 'Tournament Invitation';
    const body = `${params.inviterName} invited you to join "${params.tournamentTitle}"`;

    await this.channelService.send({
      userId: params.userId,
      type: 'tournament_invite',
      title,
      body,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        inviterName: params.inviterName,
        expiresAt: params.expiresAt,
      },
    });

    this.logger.info({
      event: 'tournament_invite_notification_sent',
      userId: params.userId,
      tournamentId: params.tournamentId,
    });
  }

  /**
   * Send a tournament joined confirmation notification.
   */
  async notifyTournamentJoined(params: TournamentJoinedParams): Promise<void> {
    const title = 'Joined Tournament';
    const body = `You've successfully joined "${params.tournamentTitle}". Good luck!`;

    await this.channelService.send({
      userId: params.userId,
      type: 'tournament_started',
      title,
      body,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
      },
    });

    this.logger.info({
      event: 'tournament_joined_notification_sent',
      userId: params.userId,
      tournamentId: params.tournamentId,
    });
  }

  /**
   * Send a tournament starting notification.
   */
  async notifyTournamentStarting(params: TournamentStartingParams): Promise<void> {
    const title = 'Tournament Starting Soon!';
    const body = `"${params.tournamentTitle}" is about to begin. Get ready!`;

    await this.channelService.send({
      userId: params.userId,
      type: 'tournament_starting',
      title,
      body,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        startsAt: params.startsAt,
      },
    });

    this.logger.info({
      event: 'tournament_starting_notification_sent',
      userId: params.userId,
      tournamentId: params.tournamentId,
    });
  }

  /**
   * Send a tournament completed notification.
   */
  async notifyTournamentCompleted(params: TournamentCompletedParams): Promise<void> {
    const title = 'Tournament Completed';
    const body = `You finished #${params.rank} of ${params.totalParticipants} in "${params.tournamentTitle}"`;

    await this.channelService.send({
      userId: params.userId,
      type: 'tournament_completed',
      title,
      body,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        rank: params.rank,
        totalParticipants: params.totalParticipants,
      },
    });

    this.logger.info({
      event: 'tournament_completed_notification_sent',
      userId: params.userId,
      tournamentId: params.tournamentId,
      rank: params.rank,
    });
  }

  /**
   * Send a tournament won notification.
   */
  async notifyTournamentWon(params: TournamentWonParams): Promise<void> {
    const title = 'Tournament Champion!';
    const body = params.prize
      ? `Congratulations! You won "${params.tournamentTitle}"! Prize: ${params.prize}`
      : `Congratulations! You won "${params.tournamentTitle}"!`;

    await this.channelService.send({
      userId: params.userId,
      type: 'tournament_won',
      title,
      body,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        prize: params.prize,
      },
    });

    this.logger.info({
      event: 'tournament_won_notification_sent',
      userId: params.userId,
      tournamentId: params.tournamentId,
    });
  }
}
