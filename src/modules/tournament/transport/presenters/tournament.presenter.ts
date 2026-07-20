import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type {
  TournamentDetailResponseDto,
  TournamentResponseDto,
} from '../../dto/response/tournament-response.dto';
import type { TournamentLeaderboardEntryDto } from '../../dto/response/tournament-leaderboard-response.dto';
import type { TournamentParticipantListItemDto } from '../../dto/response/tournament-participants-response.dto';
import type {
  ActiveTournamentItemDto,
  CompletedTournamentItemDto,
  RelatedTournamentItemDto,
  UpcomingTournamentItemDto,
} from '../../dto/response/tournament-list-response.dto';
import type { TournamentWinnerDto } from '../../dto/response/tournament-winners-response.dto';
import type { TournamentStatsResponseDto } from '../../dto/response/tournament-stats-response.dto';
import type { MyTournamentStandingResponseDto } from '../../dto/response/tournament-stats-response.dto';
import {
  CancelTournamentResponseDto,
  SoftDeleteTournamentResponseDto,
} from '../../dto/response/tournament-admin-response.dto';
import type {
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
  UnregisterTournamentResponseDto,
  WithdrawTournamentResponseDto,
} from '../../dto/response/tournament-action-response.dto';

/**
 * Wrap a `{ items: T[], pagination: { limit, hasNextPage, nextCursor } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * Used for cursor-paginated list endpoints whose application-service return is
 * a class-instance `{ items, pagination }` DTO. The canonical envelope has to be
 * a plain object (the interceptor's `isFormattedResponse()` guards on `Object`
 * prototype), so we deliberately project out the DTO fields here instead of
 * forwarding the class instance for the interceptor to re-wrap.
 */
const wrapCursorPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}): ApiResponseEnvelope<T[]> => ({
  data: [...payload.items],
  meta: {
    timestamp: new Date().toISOString(),
    pagination: {
      kind: 'cursor' as const,
      limit: payload.pagination.limit,
      hasNextPage: payload.pagination.hasNextPage,
      nextCursor: payload.pagination.nextCursor,
    },
  },
});

/**
 * Wrap a `{ items: T[], pagination: { page, limit, total } }`
 * payload as `{ data: T[], meta: { timestamp, pagination: { kind: "offset", ... } } }`.
 *
 * `hasMore` is computed from `page < ceil(total / limit)`.
 *
 * Issue #28: Extended to handle both formats:
 *   - Legacy: { items, pagination: { page, limit, total } }
 *   - New: { items, total, limit, offset }
 */
const wrapOffsetPaginatedDto = <T>(
  payload:
    | {
        items: readonly T[];
        total: number;
        limit: number;
        offset: number;
      }
    | {
        items: readonly T[];
        pagination: { page: number; limit: number; total: number };
      },
): ApiResponseEnvelope<T[]> => {
  let page: number;
  let limit: number;
  let total: number;

  if ('pagination' in payload) {
    page = payload.pagination.page;
    limit = payload.pagination.limit;
    total = payload.pagination.total;
  } else {
    page = Math.floor(payload.offset / payload.limit) + 1;
    limit = payload.limit;
    total = payload.total;
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasMore = page < totalPages;
  return {
    data: [...payload.items],
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        kind: 'offset' as const,
        page,
        limit,
        total,
        hasMore,
      },
    },
  };
};

/**
 * Presenter for the tournament module. Wraps every application-service response
 * in the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * Endpoints that return 204 No Content or use `@Res({ passthrough: true })`
 * bypass the presenter entirely.
 */
@Injectable()
export class TournamentPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // CRUD
  readonly createTournament = TournamentPresenter.ok<TournamentResponseDto>;
  readonly getTournamentById = TournamentPresenter.ok<TournamentDetailResponseDto>;

  // Lists
  readonly listTournaments = wrapCursorPaginatedDto<TournamentResponseDto>;
  readonly getUpcomingTournaments = wrapOffsetPaginatedDto<UpcomingTournamentItemDto>;
  readonly getActiveTournaments = wrapOffsetPaginatedDto<ActiveTournamentItemDto>;
  readonly getCompletedTournaments = wrapOffsetPaginatedDto<CompletedTournamentItemDto>;
  readonly getRelatedTournaments = (payload: { items: readonly RelatedTournamentItemDto[] }) =>
    ApiResponse.ok([...payload.items]);

  // Stats & standing
  readonly getTournamentStats = TournamentPresenter.ok<TournamentStatsResponseDto>;
  readonly getMyTournamentStanding = TournamentPresenter.ok<MyTournamentStandingResponseDto>;

  // Winners & leaderboard (items-only DTOs unwrapped to bare arrays)
  readonly getTournamentWinners = (payload: { items: readonly TournamentWinnerDto[] }) =>
    ApiResponse.ok([...payload.items]);
  // Issue #28: Leaderboard is now paginated with limit/offset.
  readonly getLeaderboard = wrapOffsetPaginatedDto<TournamentLeaderboardEntryDto>;

  // Participants (offset paginated DTO)
  readonly getTournamentParticipants = wrapOffsetPaginatedDto<TournamentParticipantListItemDto>;

  // Participant actions
  readonly registerForTournament = TournamentPresenter.ok<RegisterTournamentResponseDto>;
  readonly startRoundAttempt = TournamentPresenter.ok<StartTournamentAttemptResponseDto>;
  readonly unregisterFromTournament = TournamentPresenter.ok<UnregisterTournamentResponseDto>;
  readonly withdrawFromTournament = TournamentPresenter.ok<WithdrawTournamentResponseDto>;

  // Phase 1 / Issue #1 — admin endpoints (PATCH / DELETE / cancel).
  // PATCH returns the updated `TournamentResponseDto`; the rest use
  // dedicated envelope-friendly DTOs (`CancelTournamentResponseDto`,
  // `SoftDeleteTournamentResponseDto`).
  readonly updateTournament = TournamentPresenter.ok<TournamentResponseDto>;
  readonly cancelTournament = TournamentPresenter.ok<CancelTournamentResponseDto>;
  readonly softDeleteTournament = TournamentPresenter.ok<SoftDeleteTournamentResponseDto>;
}
