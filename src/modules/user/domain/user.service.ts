import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { MyTournamentHistoryRow, MyTournamentRow, MyTournamentAnalyticsRow, PublicTournamentProfileRow, UserActivityRow, UserBadgeRow, UserMeRow } from './ports/user-repository.port';
import { UserAnalyticsNotFoundError, UserRankingNotFoundError } from './errors';
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
import type { GetUserTournamentHistoryQuery } from './types/get-user-tournament-history.query';
import type { GetMyTournamentAnalyticsQuery } from './types/get-my-tournament-analytics.query';

const XP_PER_LEVEL = 500;

function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

@Injectable()
export class UserDomainService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
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

  async listUserBadges(
    userId: string,
    query: ListUserBadgesQuery,
  ): Promise<{
    items: UserBadgeRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { earnedAt: string; userBadgeId: string } | null;
  }> {
    await this.getMe(userId);

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

  async getUserRanking(userId: string): Promise<UserRankingSummary> {
    await this.getMe(userId);

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

  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    await this.getMe(userId);

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

  async getMyTournaments(
    query: GetMyTournamentsQuery,
  ): Promise<{ items: MyTournamentRow[]; total: number; page: number; limit: number }> {
    await this.getMe(query.userId);

    const page = query.page;
    const limit = query.limit;

    const result = await this.userRepository.listMyTournaments({
      userId: query.userId,
      page,
      limit,
    });

    this.logger.info({
      event: 'user_my_tournaments_listed',
      userId: query.userId,
      page,
      limit,
      total: result.total,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async getMyTournamentHistory(
    query: GetMyTournamentHistoryQuery,
  ): Promise<{ items: MyTournamentHistoryRow[]; total: number; page: number; limit: number }> {
    await this.getMe(query.userId);

    const page = query.page;
    const limit = query.limit;

    const result = await this.userRepository.listMyTournamentHistory({
      userId: query.userId,
      page,
      limit,
    });

    this.logger.info({
      event: 'user_my_tournament_history_listed',
      userId: query.userId,
      page,
      limit,
      total: result.total,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async getUserTournamentHistory(
    query: GetUserTournamentHistoryQuery,
  ): Promise<{ items: MyTournamentHistoryRow[]; total: number; page: number; limit: number }> {
    await this.getMe(query.userId);

    const page = query.page;
    const limit = query.limit;

    const result = await this.userRepository.listMyTournamentHistory({
      userId: query.userId,
      page,
      limit,
    });

    this.logger.info({
      event: 'user_public_tournament_history_listed',
      userId: query.userId,
      page,
      limit,
      total: result.total,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async getPublicTournamentProfile(
    query: GetPublicTournamentProfileQuery,
  ): Promise<PublicTournamentProfileRow> {
    await this.getMe(query.userId);

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
