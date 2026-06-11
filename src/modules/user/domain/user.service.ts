import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  MyTournamentHistoryRow,
  MyTournamentRow,
  MyTournamentAnalyticsRow,
  PublicTournamentProfileRow,
  UserActivityRow,
  UserBadgeRow,
  UserMeRow,
} from './ports/user-repository.port';
import {
  UserAnalyticsNotFoundError,
  UserProfilePrivateError,
  UserRankingNotFoundError,
} from './errors';
import type {
  ListUserBadgesQuery,
  UpdateProfileCommand,
  UpdateSettingsCommand,
  UserRankingSummary,
} from './types/user-commands';
import type { UserAnalytics } from './types/user-analytics';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { UserNotFoundError } from './errors';
import type { ListUserActivityQuery } from './types/list-user-activity.query';
import type { GetMyTournamentsQuery } from './types/get-my-tournaments.query';
import type { GetMyTournamentHistoryQuery } from './types/get-my-tournament-history.query';
import type { GetPublicTournamentProfileQuery } from './types/get-public-tournament-profile.query';
import type { GetMyTournamentAnalyticsQuery } from './types/get-my-tournament-analytics.query';
import { XP_PER_LEVEL } from './constants/user.domain-constants';
import {
  USER_DOMAIN_EVENT_BUS,
  type UserDomainEventBusPort,
} from './events/user-domain-event-bus.port';
import { UserProfileUpdatedEvent, UserSettingsUpdatedEvent } from './events/user-domain.events';

function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

@Injectable()
export class UserDomainService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(USER_DOMAIN_EVENT_BUS)
    private readonly eventBus: UserDomainEventBusPort,
    @InjectPinoLogger(UserDomainService.name) private readonly logger: PinoLogger,
  ) {}

  async getMe(userId: string): Promise<UserMeRow> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      this.logger.warn({ event: 'user_get_me_not_found', userId });
      throw new UserNotFoundError();
    }

    return user;
  }

  async isUserProfilePublic(targetUserId: string): Promise<boolean> {
    const settings = await this.userRepository.findUserProfileSettings(targetUserId);
    return settings?.isPublic ?? true;
  }

  async assertProfileVisible(targetUserId: string, requesterId: string): Promise<void> {
    if (requesterId === targetUserId) return;
    const isPublic = await this.isUserProfilePublic(targetUserId);
    if (!isPublic) {
      throw new UserProfilePrivateError(targetUserId);
    }
  }

  async listUserBadges(
    userId: string,
    requesterId: string,
    query: ListUserBadgesQuery,
  ): Promise<{
    items: UserBadgeRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { earnedAt: string; userBadgeId: string } | null;
  }> {
    await this.assertProfileVisible(userId, requesterId);

    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.userRepository.listUserBadges({
      userId,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { earnedAt: lastItem.earnedAt, userBadgeId: lastItem.userBadgeId }
          : null,
    };
  }

  async getUserRanking(userId: string, requesterId: string): Promise<UserRankingSummary> {
    await this.assertProfileVisible(userId, requesterId);

    const ranking = await this.userRepository.getUserRanking(userId);

    if (!ranking) {
      this.logger.warn({ event: 'user_ranking_not_found', userId });
      throw new UserRankingNotFoundError();
    }

    return {
      userId: ranking.userId,
      globalRank: ranking.globalRank,
      totalScore: ranking.totalScore,
      level: calculateLevel(ranking.totalScore),
      updatedAt: ranking.updatedAt,
    };
  }

  async getUserAnalytics(userId: string, requesterId: string): Promise<UserAnalytics> {
    await this.assertProfileVisible(userId, requesterId);

    const analytics = await this.userRepository.getUserAnalytics(userId);

    if (!analytics) {
      this.logger.warn({ event: 'user_analytics_not_found', userId });
      throw new UserAnalyticsNotFoundError();
    }

    return analytics;
  }

  async updateProfile(userId: string, command: UpdateProfileCommand): Promise<UserMeRow> {
    const patch: {
      displayName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if ('displayName' in command && command.displayName !== undefined) {
      patch.displayName = command.displayName?.trim() ?? null;
    }

    if ('bio' in command) {
      patch.bio = command.bio?.trim() ?? null;
    }

    if ('avatarUrl' in command) {
      patch.avatarUrl = command.avatarUrl?.trim() ?? null;
    }

    if (Object.keys(patch).length === 0) {
      return this.getMe(userId);
    }

    const nowIso = new Date().toISOString();
    const updated = await this.userRepository.updateProfile(userId, patch, nowIso);

    if (!updated) {
      this.logger.warn({ event: 'user_profile_update_not_found', userId });
      throw new UserNotFoundError();
    }

    this.logger.info({ event: 'user_profile_updated', userId });

    this.eventBus.emitProfileUpdated(
      new UserProfileUpdatedEvent(
        userId,
        Object.keys(patch) as ('displayName' | 'bio' | 'avatarUrl')[],
        nowIso,
      ),
    );

    return updated;
  }

  async updateSettings(userId: string, command: UpdateSettingsCommand): Promise<UserMeRow> {
    const settings = command.settings;

    const nowIso = new Date().toISOString();
    const updated = await this.userRepository.updateSettings(userId, settings, nowIso);

    if (!updated) {
      this.logger.warn({ event: 'user_settings_update_not_found', userId });
      throw new UserNotFoundError();
    }

    this.logger.info({ event: 'user_settings_updated', userId });

    this.eventBus.emitSettingsUpdated(new UserSettingsUpdatedEvent(userId, nowIso));

    return updated;
  }

  async listUserActivity(
    userId: string,
    query: ListUserActivityQuery,
  ): Promise<{
    items: UserActivityRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; eventId: string } | null;
  }> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ?? null;

    const rows = await this.userRepository.listUserActivity({
      userId,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, eventId: lastItem.eventId }
          : null,
    };
  }

  async getMyTournaments(query: GetMyTournamentsQuery & { requesterId: string }): Promise<{
    items: MyTournamentRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { registeredAt: string; participantId: string } | null;
  }> {
    await this.assertProfileVisible(query.userId, query.requesterId);

    const limit = query.limit ?? 20;
    const cursor = query.cursor ?? null;

    const { items, hasNextPage } = await this.userRepository.listMyTournaments({
      userId: query.userId,
      limit,
      cursor,
    });

    const lastItem = items.at(-1);

    this.logger.info({
      event: 'user_my_tournaments_listed',
      userId: query.userId,
      limit,
      hasNextPage,
    });

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { registeredAt: lastItem.registeredAt, participantId: lastItem.participantId }
          : null,
    };
  }

  async getMyTournamentHistory(
    query: GetMyTournamentHistoryQuery & { requesterId: string },
  ): Promise<{
    items: MyTournamentHistoryRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { completedAt: string; participantId: string } | null;
  }> {
    await this.assertProfileVisible(query.userId, query.requesterId);

    const limit = query.limit ?? 20;
    const cursor = query.cursor ?? null;

    const { items, hasNextPage } = await this.userRepository.listMyTournamentHistory({
      userId: query.userId,
      limit,
      cursor,
    });

    const lastItem = items.at(-1);

    this.logger.info({
      event: 'user_my_tournament_history_listed',
      userId: query.userId,
      limit,
      hasNextPage,
    });

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { completedAt: lastItem.completedAt, participantId: lastItem.participantId }
          : null,
    };
  }

  async getPublicTournamentProfile(
    query: GetPublicTournamentProfileQuery & { requesterId: string },
  ): Promise<PublicTournamentProfileRow> {
    await this.assertProfileVisible(query.userId, query.requesterId);

    const profile = await this.userRepository.getPublicTournamentProfile(query.userId);

    this.logger.info({
      event: 'user_public_tournament_profile_retrieved',
      userId: query.userId,
      tournamentsPlayed: profile.tournamentsPlayed,
      tournamentsWon: profile.tournamentsWon,
    });

    return profile;
  }

  async getMyTournamentAnalytics(
    query: GetMyTournamentAnalyticsQuery,
  ): Promise<MyTournamentAnalyticsRow> {
    await this.getMe(query.userId);

    const analytics = await this.userRepository.getMyTournamentAnalytics(query.userId);

    this.logger.info({
      event: 'user_my_tournament_analytics_retrieved',
      userId: query.userId,
      tournamentsPlayed: analytics.tournamentsPlayed,
      wins: analytics.wins,
    });

    return analytics;
  }
}
