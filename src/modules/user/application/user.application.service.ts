import { BadRequestException, Injectable } from '@nestjs/common';
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
import type { UserMeResponseDto } from '../dto/response/user-me.dto';
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
import { isObjectRecord } from '@/common/utils/object.util';

@Injectable()
export class UserApplicationService {
  constructor(
    private readonly userDomainService: UserDomainService,
    @InjectPinoLogger(UserApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getMe(userId: string): Promise<UserMeResponseDto> {
    const row = await this.userDomainService.getMe(userId);
    return UserResponseMapper.toUserMeResponse(row);
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
    const command: UpdateProfileCommand = {
      displayName: dto.displayName,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
    };
    const row = await this.userDomainService.updateProfile(userId, command);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async updateSettings(userId: string, dto: UpdateMeSettingsDto): Promise<UserMeResponseDto> {
    // Phase 3 (F-6): the DTO is now two optional sub-objects
    // (`preferences`, `privacy`). Reject the request if the client
    // sent neither — the previous whole-object replace semantics
    // turned an empty body into a successful "no-op", which is
    // confusing for clients and wasteful for the database.
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
    return UserResponseMapper.toUserMeResponse(row);
  }

  /**
   * Phase 4 (F-29): Renamed from `listUserActivity` to match the
   * `/users/me/activity` route. The underlying domain / repository method
   * keeps its name (it's an internal boundary).
   */
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
    // Phase 3 (F-12): `userId` and `requesterId` are always the same value
    // for this endpoint — the controller only calls this method from the
    // `/users/me/tournaments` route. The cross-user variant lives in
    // `getPublicTournamentProfile`. The `assertPrivacyFlag` check below
    // short-circuits for self so the requesterId is functionally
    // documentation, not enforcement. Kept in the signature for symmetry
    // with `getMyTournamentHistory` (which is called from both `/me/*`
    // and `/users/:userId/*`).
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

  /**
   * Phase 4 (F-10): public counterpart of `getMyTournamentHistory`,
   * called from `GET /users/:userId/tournament-history`. Returns a
   * `PublicTournamentHistoryResponseDto` (privacy-aware) rather than the
   * me-shaped DTO so OpenAPI can document the privacy-gating behaviour
   * separately. The wire shape is currently identical to the me
   * endpoint; the two DTOs may diverge in the future.
   */
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

/**
 * Phase 8 (F-24): shared `toPagination` helper. Each cursor-paginated
 * list endpoint previously inlined the same `{ limit, hasNextPage,
 * nextCursor }` construction with the cursor serializer passed as an
 * arrow function — five copies of the same template. The helper
 * collapses that into a single call site. `serialize` is generic
 * over the cursor payload type so each mapper keeps its own type.
 *
 * Module-level (not a class method) so callers do not need `this`,
 * and so the `@typescript-eslint/unbound-method` rule does not flag
 * passing the cursor mappers' static `serialize` references as the
 * callback. The mapper `serialize` methods are explicitly annotated
 * `this: void` so the rule recognises them as pure functions.
 */
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

/**
 * Phase 6 (F-27): `user_activity_events.metadata` is JSONB and is not
 * validated at write time, so a row may contain `null`, an array,
 * a string, or a scalar — anything the JSONB column accepted. The
 * DTO contract (`metadata: Record<string, unknown>`) requires an
 * object. The audit recommends "log and continue" because the
 * activity timeline is best-effort and individual corrupted rows
 * should not fail the whole page. We log a warning with the
 * `eventId` so corrupted rows can be identified in monitoring, and
 * map the offending row to `metadata: null`. The DTO field is now
 * nullable (see `UserActivityItemDto.metadata`).
 */
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
