import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  MyTournamentHistoryRow,
  MyTournamentRow,
  MyTournamentAnalyticsRow,
  PublicTournamentProfileRow,
  UserActivityRow,
  UserBadgeRow,
  UserLookupRow,
  UserMeRow,
  UserRankingRow,
} from './ports/user-repository.port';
import { UserProfilePrivateError } from './errors';
import type {
  ListUserBadgesQuery,
  UpdateProfileCommand,
  UpdateSettingsCommand,
  UserRankingSummary,
} from './types/user-commands';
import type { UserAnalytics } from './types/user-analytics';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { UserNotFoundError, UserAnalyticsNotFoundError } from './errors';
import type { ListUserActivityQuery } from './types/list-user-activity.query';
import type { GetMyTournamentsQuery } from './types/get-my-tournaments.query';
import type { GetMyTournamentHistoryQuery } from './types/get-my-tournament-history.query';
import type { GetPublicTournamentProfileQuery } from './types/get-public-tournament-profile.query';
import type { GetMyTournamentAnalyticsQuery } from './types/get-my-tournament-analytics.query';
import {
  PROFILE_AVATAR_URL_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  XP_PER_LEVEL,
} from './constants/user.domain-constants';
import {
  USER_DOMAIN_EVENT_BUS,
  type UserDomainEventBusPort,
} from './events/user-domain-event-bus.port';
import { UserProfileUpdatedEvent, UserSettingsUpdatedEvent } from './events/user-domain.events';
import { AuditLogService } from '@/common/audit/audit-log.service';

function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

/** DI token for `UserDomainService` — allows other modules (e.g. quiz) to inject it without importing the concrete class. */
export const USER_DOMAIN_SERVICE = Symbol('USER_DOMAIN_SERVICE');

@Injectable()
export class UserDomainService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(USER_DOMAIN_EVENT_BUS)
    private readonly eventBus: UserDomainEventBusPort,
    private readonly auditLogService: AuditLogService,
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

  /**
   * Phase 1 (S-1): resolve `username` to a `UserLookupRow` projection
   * or throw `UserNotFoundError`. The lookup is intentionally cheap
   * (indexed btree on `users.username`) and public — the controller
   * mounts the route with `@Public()`. Privacy (`isPublic` /
   * `showStatistics` / …) is NOT enforced here because the response
   * only exposes fields a public profile page is allowed to render
   * (avatar, display name, verified flag). The deeper
   * privacy-gated reads (`/users/:userId/badges`, `/users/:userId/analytics`,
   * …) still gate on `assertPrivacyFlag`.
   */
  async getUserByUsername(username: string): Promise<UserLookupRow> {
    const row = await this.userRepository.findByUsername(username);
    if (!row) {
      this.logger.warn({
        event: 'user_lookup_by_username_not_found',
        username,
      });
      throw new UserNotFoundError();
    }
    return row;
  }

  async isUserProfilePublic(targetUserId: string): Promise<boolean> {
    const settings = await this.userRepository.findUserPrivacyFlags(targetUserId);
    return settings?.isPublic ?? true;
  }

  /**
   * Phase 2.3 (H5): Added `findMeById` check so a non-existent user throws
   * `UserNotFoundError` (→ 404) instead of silently returning 200 with empty
   * data.  The privacy check (`isUserProfilePublic`) runs only when the user
   * is known to exist, preserving the documented 404 contract.
   *
   * Phase 3 (F-4): The `requesterId === targetUserId` shortcut used to
   * `return` early *without* an existence check. A soft-deleted user's JWT
   * therefore reached `getUserRanking` / `getUserAnalytics` / etc. and
   * crashed with a 500. Now we always run the existence check first; only
   * the privacy check is skipped for self-requests.
   */
  async assertProfileVisible(targetUserId: string, requesterId: string): Promise<void> {
    const user = await this.userRepository.findMeById(targetUserId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (requesterId === targetUserId) return;

    const isPublic = await this.isUserProfilePublic(targetUserId);
    if (!isPublic) {
      throw new UserProfilePrivateError(targetUserId);
    }
  }

  /**
   * Phase 3 (F-7): Enforce one of the granular privacy flags
   * (`showStatistics` / `showAchievements` / `showActivity` /
   * `showTournamentActivity`). Always runs the existence check first
   * (F-4) so a soft-deleted user produces a 404 (not a 500), then
   * returns early when the requester is the owner. Throws
   * `UserProfilePrivateError` (→ 403) when the flag is `false` and
   * the requester is not the owner.
   *
   * Defaults are read from `user_profile_settings` (every flag
   * defaults to `true`); when no row exists at all, `null` is treated
   * as "all defaults true", matching the behaviour a freshly
   * registered user would see.
   */
  async assertPrivacyFlag(
    targetUserId: string,
    requesterId: string,
    flag: 'showStatistics' | 'showAchievements' | 'showActivity' | 'showTournamentActivity',
  ): Promise<void> {
    const user = await this.userRepository.findMeById(targetUserId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (requesterId === targetUserId) return;

    const flags = await this.userRepository.findUserPrivacyFlags(targetUserId);
    // Schema defaults apply when no settings row exists.
    const allowed = flags?.[flag] ?? true;
    if (!allowed) {
      throw new UserProfilePrivateError(targetUserId);
    }
  }

  /**
   * Phase 1 (F-1): Creator analytics are private to the creator. Only the
   * user themselves may read their own creator analytics — never another
   * authenticated user. Throws `UserAnalyticsNotFoundError` (→ 404) to
   * preserve the documented "user not found" contract for cross-user reads
   * and to avoid leaking the existence of the target's analytics.
   */
  assertCanReadCreatorAnalytics(requesterId: string, targetUserId: string): void {
    if (requesterId !== targetUserId) {
      throw new UserAnalyticsNotFoundError();
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
    // Phase 3 (F-7): `showAchievements` gates cross-user badge reads.
    // The master `isPublic` toggle is checked inside `assertPrivacyFlag`.
    await this.assertPrivacyFlag(userId, requesterId, 'showAchievements');

    // Phase 8 (F-20): unified default across user-paginated endpoints.
    // The audit recommends 20 as the cross-module default.
    const limit = query.limit ?? 20;
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

  /**
   * Phase 4.1 (L1): Calling this method may create a `user_rankings` row
   * (write-on-read) if the user has no ranking yet. The 200 response is
   * still returned either way, but the first call has a side effect.
   */
  /**
   * Side effect (Phase 6 / F-19): if the target user has no `user_ranking`
   * row, this method inserts an empty one before returning. The lazy
   * creation is intentional — it lets a brand-new user read their
   * ranking immediately after sign-up, without waiting for a quiz
   * completion. The side effect is already documented in the Swagger
   * `ApiUserRankingResponse` decorator but it is also worth noting it
   * here because the lazy-write changes the caller's read-write mix:
   * a `GET` to this endpoint can produce a row insert. See
   * `docs/plans/denormalized-counters-audit.md` for the broader
   * counter-rebuild story; revisit during the ranking cleanup PR.
   */
  async getUserRanking(userId: string, requesterId: string): Promise<UserRankingSummary> {
    // Phase 3 (F-7): `showStatistics` gates cross-user ranking reads.
    await this.assertPrivacyFlag(userId, requesterId, 'showStatistics');

    let ranking = await this.userRepository.getUserRanking(userId);

    if (!ranking) {
      void this.logger.warn({ event: 'user_ranking_not_found_creating', userId });
      const created: UserRankingRow = await this.userRepository.createUserRanking(userId);
      ranking = created;
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
    // Phase 3 (F-7): `showStatistics` gates cross-user analytics reads.
    await this.assertPrivacyFlag(userId, requesterId, 'showStatistics');

    return await this.userRepository.getUserAnalytics(userId);
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

    // Phase 6 (F-16): defensive re-check of the trimmed lengths.
    // The DTO transform (`trimStringToNullIfBlank`) already runs before
    // `@MaxLength`, so the request layer rejects oversized inputs at
    // the boundary. This block is belt-and-suspenders for any future
    // internal caller that bypasses the controller — it surfaces a
    // 400 with a clear field-level message instead of letting an
    // oversized payload reach the database.
    if (patch.displayName !== undefined && patch.displayName !== null) {
      if (
        patch.displayName.length < 1 ||
        patch.displayName.length > PROFILE_DISPLAY_NAME_MAX_LENGTH
      ) {
        throw new BadRequestException({
          code: 'PROFILE_DISPLAY_NAME_LENGTH_OUT_OF_RANGE',
          message: `displayName length must be between 1 and ${PROFILE_DISPLAY_NAME_MAX_LENGTH} characters after trimming`,
          field: 'displayName',
        });
      }
    }

    if (patch.bio !== undefined && patch.bio !== null) {
      if (patch.bio.length > PROFILE_BIO_MAX_LENGTH) {
        throw new BadRequestException({
          code: 'PROFILE_BIO_LENGTH_EXCEEDED',
          message: `bio length must be at most ${PROFILE_BIO_MAX_LENGTH} characters after trimming`,
          field: 'bio',
        });
      }
    }

    if (patch.avatarUrl !== undefined && patch.avatarUrl !== null) {
      if (patch.avatarUrl.length > PROFILE_AVATAR_URL_MAX_LENGTH) {
        throw new BadRequestException({
          code: 'PROFILE_AVATAR_URL_LENGTH_EXCEEDED',
          message: `avatarUrl length must be at most ${PROFILE_AVATAR_URL_MAX_LENGTH} characters after trimming`,
          field: 'avatarUrl',
        });
      }
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

    // Audit: profile changes. The auth audit log used to be the
    // only place to record such changes, but it was scoped to
    // auth events and the user module never wrote to it. The
    // new cross-domain `AuditLogService` covers this and gives
    // us a structured `domain='user'`, `action='profile.updated'`
    // pair for cross-domain reporting. Failures are swallowed —
    // an audit-log write must never break the user-facing
    // operation.
    try {
      await this.auditLogService.record({
        eventType: 'user.profile.updated',
        domain: 'user',
        action: 'profile.updated',
        actorId: userId,
        subjectUserId: userId,
        metadata: {
          changedFields: Object.keys(patch),
        },
        createdAt: nowIso,
      });
    } catch (error) {
      this.logger.error({
        event: 'user_profile_audit_write_failed',
        userId,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

    return updated;
  }

  async updateSettings(userId: string, command: UpdateSettingsCommand): Promise<UserMeRow> {
    const nowIso = new Date().toISOString();

    // Phase 3 (F-6): route the two sub-commands to the matching
    // repository methods. Either may be `undefined`, in which case the
    // repository treats it as a no-op (it still returns a fresh row).
    const updated = await this.userRepository.updatePreferences(
      userId,
      command.preferences,
      nowIso,
    );
    if (!updated) {
      this.logger.warn({ event: 'user_preferences_update_not_found', userId });
      throw new UserNotFoundError();
    }

    if (command.privacy !== undefined) {
      const afterPrivacy = await this.userRepository.updatePrivacy(userId, command.privacy, nowIso);
      if (!afterPrivacy) {
        this.logger.warn({ event: 'user_privacy_update_not_found', userId });
        throw new UserNotFoundError();
      }
    }

    this.logger.info({
      event: 'user_settings_updated',
      userId,
      changedFields: {
        preferences: command.preferences !== undefined,
        privacy: command.privacy !== undefined,
      },
    });

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
    // Phase 3 (F-7 + F-12): `showTournamentActivity` gates cross-user
    // tournament reads. The controller currently passes the same value
    // for both `targetUserId` and `requesterId` (see F-12 in the audit
    // document), which means self-requests always short-circuit through
    // `assertPrivacyFlag`'s `requesterId === targetUserId` early-return.
    // The flag enforcement therefore matters only for the
    // `/users/:userId/tournaments` cross-user route, which goes through
    // this same domain method.
    await this.assertPrivacyFlag(query.userId, query.requesterId, 'showTournamentActivity');

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
    // Phase 3 (F-7): `showTournamentActivity` gates cross-user tournament
    // history reads. Self-requests (the `/me/tournament-history` route)
    // short-circuit through the existence check + the early-return for
    // self inside `assertPrivacyFlag`.
    await this.assertPrivacyFlag(query.userId, query.requesterId, 'showTournamentActivity');

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
    // Phase 3 (F-7): `showTournamentActivity` gates cross-user tournament
    // profile reads.
    await this.assertPrivacyFlag(query.userId, query.requesterId, 'showTournamentActivity');

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
