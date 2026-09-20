import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UserDomainService } from '../domain/user.service';
import { UserResponseMapper } from '../mappers/user-response.mapper';
import { UserBadgeCursorMapper } from '../mappers/user-badge-cursor.mapper';
import { UserAnalyticsResponseMapper } from '../mappers/user-analytics-response.mapper';
import { UserActivityCursorMapper } from '../mappers/user-activity-cursor.mapper';
import { MyTournamentCursorMapper } from '../mappers/my-tournament-cursor.mapper';
import { MyTournamentHistoryCursorMapper } from '../mappers/my-tournament-history-cursor.mapper';
import { UpdateMeDto } from '../dto/request/update-me.dto';
import { UpdateMeSettingsDto } from '../dto/request/update-me-settings.dto';
import type { GetMyTournamentsQueryDto } from '../dto/request/get-my-tournaments-query.dto';
import type { GetMyTournamentHistoryQueryDto } from '../dto/request/get-my-tournament-history-query.dto';
import type { UserActivityResponseDto } from '../dto/response/user-activity.dto';
import type { UserLookupResponseDto } from '../dto/response/user-lookup.dto';
import type { UserMeResponseDto } from '../dto/response/user-me.dto';
import type { UserSummaryResponseDto } from '../dto/response/user-summary.dto';
import type { UserBadgesResponseDto } from '../dto/response/user-badges.dto';
import type { UserRankingResponseDto } from '../dto/response/user-ranking.dto';
import type { UserAnalyticsResponseDto } from '../dto/response/user-analytics.dto';
import type { MyTournamentsResponseDto } from '../dto/response/my-tournaments.dto';
import type { MyTournamentHistoryResponseDto } from '../dto/response/my-tournament-history.dto';
import type { MyTournamentAnalyticsResponseDto } from '../dto/response/my-tournament-analytics.dto';
import type { PublicTournamentProfileResponseDto } from '../dto/response/public-tournament-profile.dto';
import type { PublicTournamentHistoryResponseDto } from '../dto/response/public-tournament-history.dto';
import type { ListUserBadgesQueryDto } from '../dto/request/list-user-badges-query.dto';
import type { ListUserActivityQueryDto } from '../dto/request/list-user-activity-query.dto';
import type { UpdateProfileCommand, UpdateSettingsCommand } from '../domain/types/user-commands';
import type { UserActivityRow } from '../domain/ports/user-repository.port';
import { projectLevel, resolveLevelTitleLabel } from '../domain/types/level.types';
import { isObjectRecord } from '@/common/utils/object.util';
import { QUIZ_LISTING_PORT, type QuizListingPort } from '@/modules/quiz/domain/analytics';
import { SocialService } from '@/modules/social/domain/services/social.service';
import {
  COIN_REPOSITORY_PORT,
  type CoinRepositoryPort,
} from '@/modules/coins/domain/ports/coin-repository.port';
import { StorageApplicationService } from '@/core/storage/application/storage.application.service';
import { StorageImageLifecycleService } from '@/core/storage/application/storage-image-lifecycle.service';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';

@Injectable()
export class UserApplicationService {
  constructor(
    private readonly userDomainService: UserDomainService,
    private readonly mapper: UserResponseMapper,
    @Inject(QUIZ_LISTING_PORT)
    private readonly quizListing: QuizListingPort,
    private readonly socialService: SocialService,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    private readonly storageOwnership: StorageApplicationService,
    private readonly storageLifecycle: StorageImageLifecycleService,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(UserApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getMe(userId: string): Promise<UserMeResponseDto> {
    const row = await this.userDomainService.getMe(userId);
    return this.mapper.toUserMeResponse(row);
  }

  async getUserByUsername(username: string): Promise<UserLookupResponseDto> {
    const row = await this.userDomainService.getUserByUsername(username);
    return this.mapper.toUserLookupResponse(row);
  }

  async getMySummary(userId: string, acceptLanguage?: string): Promise<UserSummaryResponseDto> {
    const [me, quizAnalytics, userAnalytics, socialCounts, wallet] = await Promise.all([
      this.userDomainService.getMe(userId),
      this.quizListing.getMyQuizAnalytics(userId),
      this.userDomainService.getUserAnalytics(userId, userId),
      this.socialService.getSocialCounts(userId),
      this.coinRepository.getWallet(userId),
    ]);

    const level = projectLevel(me.xpTotal);

    return {
      userId: me.userId,
      username: me.username,
      displayName: me.displayName,
      avatarUrl: this.mapper.resolveAvatarUrl(me.avatarPublicId, me.avatarUrl),
      bio: me.bio,
      country: null,
      countryCode: null,
      bgImageUrl: null,
      createdAt: me.createdAt,
      updatedAt: me.updatedAt,
      xpTotal: me.xpTotal,
      level: level.level,
      currentLevelXP: level.currentLevelXP,
      nextLevelXP: level.nextLevelXP,
      xpProgressPercent: level.xpProgressPercent,
      levelTitle: level.levelTitle,
      levelTitleLocalised: resolveLevelTitleLabel(level.levelTitle, acceptLanguage),
      currentStreak: me.currentStreak,
      longestStreak: me.longestStreak,
      quizzesCreated: quizAnalytics.totalQuizzes,
      quizzesPublished: quizAnalytics.publishedQuizzes,
      quizzesTaken: userAnalytics.summary.completedQuizzes,
      followers: socialCounts.followerCount,
      following: socialCounts.followingCount,
      friends: socialCounts.friendCount,
      coinBalance: wallet?.balance ?? 0,
    };
  }

  async listUserBadges(
    userId: string,
    requesterId: string,
    query: ListUserBadgesQueryDto,
  ): Promise<UserBadgesResponseDto> {
    const cursor = query.cursor ? UserBadgeCursorMapper.parse(query.cursor) : null;

    const { items, limit, hasNextPage, nextCursor } = await this.userDomainService.listUserBadges(
      userId,
      requesterId,
      { limit: query.limit, cursor },
    );

    return this.toUserBadgesResponse(items, limit, hasNextPage, nextCursor);
  }

  async getUserRanking(userId: string, requesterId: string): Promise<UserRankingResponseDto> {
    const summary = await this.userDomainService.getUserRanking(userId, requesterId);
    return summary;
  }

  async getUserAnalytics(userId: string, requesterId: string): Promise<UserAnalyticsResponseDto> {
    const analytics = await this.userDomainService.getUserAnalytics(userId, requesterId);
    return UserAnalyticsResponseMapper.toResponse(analytics);
  }

  async updateProfile(userId: string, dto: UpdateMeDto): Promise<UserMeResponseDto> {
    if (dto.avatarPublicId !== undefined && dto.avatarPublicId !== null) {
      const owns = await this.storageOwnership.userOwnsAssetForPurpose({
        publicId: dto.avatarPublicId,
        ownerId: userId,
        purpose: 'avatar',
      });
      if (!owns) {
        throw new ForbiddenException({
          code: 'ASSET_NOT_OWNED',
          message:
            'The supplied avatar publicId is not owned by the authenticated user for the avatar purpose.',
        });
      }
    }

    const command: UpdateProfileCommand = {
      displayName: dto.displayName,
      bio: dto.bio,
      avatarPublicId: dto.avatarPublicId,
    };
    const row = await this.userDomainService.updateProfile(userId, command);
    if (!row) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: 'The authenticated user could not be located.',
      });
    }

    const newPublicId = dto.avatarPublicId !== undefined ? dto.avatarPublicId : row.avatarPublicId;
    // Fail open: the profile update has already succeeded. The avatar
    // (if any) is auxiliary metadata and the lifecycle service is best
    // effort — surface failures as a warn log rather than failing the
    // whole PATCH. See issue `user_profile_update_lifecycle_fail_open`.
    try {
      await this.storageLifecycle.replaceAvatar(userId, newPublicId, (id) =>
        this.userRepository.findAvatarPublicIdByUserId(id),
      );
    } catch (err) {
      this.logger.warn({
        event: 'storage_lifecycle_unexpected_error',
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    return this.mapper.toUserMeResponse(row);
  }

  async updateSettings(userId: string, dto: UpdateMeSettingsDto): Promise<UserMeResponseDto> {
    if (dto.preferences === undefined && dto.privacy === undefined) {
      throw new BadRequestException(
        'UpdateMeSettings requires at least one of `preferences` or `privacy`',
      );
    }
    const command: UpdateSettingsCommand = {
      preferences: dto.preferences,
      privacy: dto.privacy,
    };
    const row = await this.userDomainService.updateSettings(userId, command);
    return this.mapper.toUserMeResponse(row);
  }

  async listMyActivity(
    userId: string,
    query: ListUserActivityQueryDto,
  ): Promise<UserActivityResponseDto> {
    const cursor = query.cursor ? UserActivityCursorMapper.parse(query.cursor) : null;

    const { items, limit, hasNextPage, nextCursor } = await this.userDomainService.listUserActivity(
      userId,
      { limit: query.limit, cursor },
    );

    return {
      items: items.map((item) => toUserActivityItem(this.logger, item)),
      pagination: toPagination(limit, hasNextPage, nextCursor, UserActivityCursorMapper.serialize),
    };
  }

  async getMyTournaments(
    userId: string,
    requesterId: string,
    query: GetMyTournamentsQueryDto,
  ): Promise<MyTournamentsResponseDto> {
    const cursor = query.cursor ? MyTournamentCursorMapper.parse(query.cursor) : null;

    const { items, limit, hasNextPage, nextCursor } = await this.userDomainService.getMyTournaments(
      {
        userId,
        requesterId,
        limit: query.limit ?? 20,
        cursor,
      },
    );

    return {
      items: items.map((item) => ({
        tournamentId: item.tournamentId,
        name: item.name,
        status: item.status,
        registeredAt: item.registeredAt,
        startAt: item.startAt,
        endAt: item.endAt,
      })),
      pagination: toPagination(limit, hasNextPage, nextCursor, MyTournamentCursorMapper.serialize),
    };
  }

  async getMyTournamentHistory(
    userId: string,
    requesterId: string,
    query: GetMyTournamentHistoryQueryDto,
  ): Promise<MyTournamentHistoryResponseDto> {
    const cursor = query.cursor ? MyTournamentHistoryCursorMapper.parse(query.cursor) : null;

    const { items, limit, hasNextPage, nextCursor } =
      await this.userDomainService.getMyTournamentHistory({
        userId,
        requesterId,
        limit: query.limit ?? 20,
        cursor,
      });

    return {
      items: items.map((item) => ({
        tournamentId: item.tournamentId,
        tournamentName: item.tournamentName,
        rank: item.finalRank,
        score: item.finalScore,
        participantCount: item.participantCount,
        completedAt: item.completedAt,
      })),
      pagination: toPagination(
        limit,
        hasNextPage,
        nextCursor,
        MyTournamentHistoryCursorMapper.serialize,
      ),
    };
  }

  async getPublicTournamentHistory(
    userId: string,
    requesterId: string,
    query: GetMyTournamentHistoryQueryDto,
  ): Promise<PublicTournamentHistoryResponseDto> {
    const cursor = query.cursor ? MyTournamentHistoryCursorMapper.parse(query.cursor) : null;

    const { items, limit, hasNextPage, nextCursor } =
      await this.userDomainService.getMyTournamentHistory({
        userId,
        requesterId,
        limit: query.limit ?? 20,
        cursor,
      });

    return {
      items: items.map((item) => ({
        tournamentId: item.tournamentId,
        tournamentName: item.tournamentName,
        rank: item.finalRank,
        score: item.finalScore,
        participantCount: item.participantCount,
        completedAt: item.completedAt,
      })),
      pagination: toPagination(
        limit,
        hasNextPage,
        nextCursor,
        MyTournamentHistoryCursorMapper.serialize,
      ),
    };
  }

  async getPublicTournamentProfile(
    userId: string,
    requesterId: string,
  ): Promise<PublicTournamentProfileResponseDto> {
    const profile = await this.userDomainService.getPublicTournamentProfile({
      userId,
      requesterId,
    });

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
      pagination: toPagination(limit, hasNextPage, nextCursor, UserBadgeCursorMapper.serialize),
    };
  }
}

const toPagination = <Cursor>(
  limit: number,
  hasNextPage: boolean,
  nextCursor: Cursor | null,
  serialize: (cursor: Cursor) => string,
): {
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
} => ({
  limit,
  hasNextPage,
  nextCursor: nextCursor ? serialize(nextCursor) : null,
});

const toUserActivityItem = (
  logger: PinoLogger,
  item: UserActivityRow,
): UserActivityResponseDto['items'][number] => {
  if (!isObjectRecord(item.metadata)) {
    logger.warn({
      event: 'user_activity_metadata_invalid_shape',
      activityEventId: item.eventId,
      eventType: item.eventType,
      metadataType:
        item.metadata === null
          ? 'null'
          : Array.isArray(item.metadata)
            ? 'array'
            : typeof item.metadata,
    });
    return {
      eventId: item.eventId,
      eventType: item.eventType,
      createdAt: item.createdAt,
      metadata: null,
    };
  }

  return {
    eventId: item.eventId,
    eventType: item.eventType,
    createdAt: item.createdAt,
    metadata: item.metadata,
  };
};
