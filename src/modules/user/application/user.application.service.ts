import { Injectable } from '@nestjs/common';
import { UserDomainService } from '../domain/user.service';
import { UserResponseMapper } from '../mappers/user-response.mapper';
import { UserBadgeCursorMapper } from '../mappers/user-badge-cursor.mapper';
import { UserAnalyticsResponseMapper } from '../mappers/user-analytics-response.mapper';
import { UserActivityCursorMapper } from '../mappers/user-activity-cursor.mapper';
import { UpdateMeDto } from '../dto/request/update-me.dto';
import { UpdateMeSettingsDto } from '../dto/request/update-me-settings.dto';
import type { GetMyTournamentsQueryDto } from '../dto/request/get-my-tournaments-query.dto';
import type { GetMyTournamentHistoryQueryDto } from '../dto/request/get-my-tournament-history-query.dto';
import type { UserActivityResponseDto } from '../dto/response/user-activity-response.dto';
import type { UserMeResponseDto } from '../dto/response/user-me-response.dto';
import type { UserBadgesResponseDto } from '../dto/response/user-badges-response.dto';
import type { UserRankingResponseDto } from '../dto/response/user-ranking-response.dto';
import type { UserAnalyticsResponseDto } from '../dto/response/user-analytics-response.dto';
import type { MyTournamentsResponseDto } from '../dto/response/my-tournaments-response.dto';
import type { MyTournamentHistoryResponseDto } from '../dto/response/my-tournament-history-response.dto';
import type { MyTournamentAnalyticsResponseDto } from '../dto/response/my-tournament-analytics-response.dto';
import type { PublicTournamentProfileResponseDto } from '../dto/response/public-tournament-profile-response.dto';
import type {
  ListUserBadgesQuery,
  UpdateProfileCommand,
  UpdateSettingsCommand,
} from '../domain/types/user-commands';
import type { UserActivityRow } from '../domain/ports/user-repository.port';
import type { ListUserActivityQuery } from '../domain/types/list-user-activity.query';
import type { GetPublicTournamentProfileQuery } from '../domain/types/get-public-tournament-profile.query';
import type { GetMyTournamentAnalyticsQuery } from '../domain/types/get-my-tournament-analytics.query';
import { isObjectRecord } from '@/common/utils/object.util';

@Injectable()
export class UserApplicationService {
  constructor(private readonly userDomainService: UserDomainService) {}

  async getMe(userId: string): Promise<UserMeResponseDto> {
    const row = await this.userDomainService.getMe(userId);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async listUserBadges(userId: string, query: ListUserBadgesQuery): Promise<UserBadgesResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.userDomainService.listUserBadges(
      userId,
      query,
    );

    return this.toUserBadgesResponse(items, limit, hasNextPage, nextCursor);
  }

  async listBadgesByUserId(
    userId: string,
    query: ListUserBadgesQuery,
  ): Promise<UserBadgesResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.userDomainService.listUserBadges(
      userId,
      query,
    );

    return this.toUserBadgesResponse(items, limit, hasNextPage, nextCursor);
  }

  async getUserRanking(userId: string): Promise<UserRankingResponseDto> {
    const summary = await this.userDomainService.getUserRanking(userId);
    return summary;
  }

  async getUserAnalytics(userId: string): Promise<UserAnalyticsResponseDto> {
    const analytics = await this.userDomainService.getUserAnalytics(userId);
    return UserAnalyticsResponseMapper.toResponse(analytics);
  }

  async updateProfile(userId: string, dto: UpdateMeDto): Promise<UserMeResponseDto> {
    const command: UpdateProfileCommand = {
      displayName: dto.displayName,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
    };
    const row = await this.userDomainService.updateProfile(userId, command);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async updateSettings(userId: string, dto: UpdateMeSettingsDto): Promise<UserMeResponseDto> {
    const command: UpdateSettingsCommand = {
      settings: dto.settings,
    };
    const row = await this.userDomainService.updateSettings(userId, command);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async listUserActivity(
    userId: string,
    query: ListUserActivityQuery,
  ): Promise<UserActivityResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.userDomainService.listUserActivity(
      userId,
      query,
    );

    return {
      items: items.map((item) => this.toUserActivityItem(item)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? UserActivityCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getMyTournaments(
    userId: string,
    query: GetMyTournamentsQueryDto,
  ): Promise<MyTournamentsResponseDto> {
    const result = await this.userDomainService.getMyTournaments({
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => ({
        tournamentId: item.tournamentId,
        name: item.name,
        status: item.status,
        registeredAt: item.registeredAt,
        startAt: item.startAt,
        endAt: item.endAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  async getMyTournamentHistory(
    userId: string,
    query: GetMyTournamentHistoryQueryDto,
  ): Promise<MyTournamentHistoryResponseDto> {
    const result = await this.userDomainService.getMyTournamentHistory({
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => ({
        tournamentId: item.tournamentId,
        tournamentName: item.tournamentName,
        rank: item.finalRank,
        score: item.finalScore,
        participantCount: item.participantCount,
        completedAt: item.completedAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  async getUserTournamentHistory(
    userId: string,
    query: GetMyTournamentHistoryQueryDto,
  ): Promise<MyTournamentHistoryResponseDto> {
    const result = await this.userDomainService.getUserTournamentHistory({
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => ({
        tournamentId: item.tournamentId,
        tournamentName: item.tournamentName,
        rank: item.finalRank,
        score: item.finalScore,
        participantCount: item.participantCount,
        completedAt: item.completedAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  async getPublicTournamentProfile(userId: string): Promise<PublicTournamentProfileResponseDto> {
    const profile = await this.userDomainService.getPublicTournamentProfile({ userId });

    return {
      userId: profile.userId,
      tournamentsPlayed: profile.tournamentsPlayed,
      tournamentsWon: profile.tournamentsWon,
      bestRank: profile.bestRank,
      averageRank: profile.averageRank,
      top10Finishes: profile.top10Finishes,
      totalTournamentScore: profile.totalTournamentScore,
      lastTournamentAt: profile.lastTournamentAt,
    };
  }

  async getMyTournamentAnalytics(userId: string): Promise<MyTournamentAnalyticsResponseDto> {
    const analytics = await this.userDomainService.getMyTournamentAnalytics({ userId });

    return {
      tournamentsPlayed: analytics.tournamentsPlayed,
      wins: analytics.wins,
      top3Finishes: analytics.top3Finishes,
      top10Finishes: analytics.top10Finishes,
      averageRank: analytics.averageRank,
      bestRank: analytics.bestRank,
      averageScore: analytics.averageScore,
      totalTournamentScore: analytics.totalTournamentScore,
      completionRate: analytics.completionRate,
      lastTournamentAt: analytics.lastTournamentAt,
    };
  }

  private toUserBadgesResponse(
    items: Awaited<ReturnType<UserDomainService['listUserBadges']>>['items'],
    limit: number,
    hasNextPage: boolean,
    nextCursor: Awaited<ReturnType<UserDomainService['listUserBadges']>>['nextCursor'],
  ): UserBadgesResponseDto {
    return {
      items: items.map((item) => ({
        badgeId: item.badgeId,
        name: item.name,
        description: item.description,
        earnedAt: item.earnedAt,
      })),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? UserBadgeCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  private toUserActivityItem(item: UserActivityRow): UserActivityResponseDto['items'][number] {
    return {
      eventId: item.eventId,
      eventType: item.eventType,
      createdAt: item.createdAt,
      metadata: isObjectRecord(item.metadata) ? item.metadata : {},
    };
  }
}
