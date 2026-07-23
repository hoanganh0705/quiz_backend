import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type {
  CancelCountdownResponseDto,
  CloseInstanceResponseDto,
  CreateInstanceResponseDto,
  JoinInstanceResponseDto,
  StartCountdownResponseDto,
  StartInstanceResponseDto,
} from '../../dto/response/instance-action-response.dto';
import type { InstanceDetailResponseDto } from '../../dto/response/instance-detail-response.dto';
import type { InstanceLeaderboardResponseDto } from '../../dto/response/instance-leaderboard-response.dto';
import type { InstanceListResponseDto } from '../../dto/response/instance-list-response.dto';
import type { InstancePlayersResponseDto } from '../../dto/response/instance-players-response.dto';

/**
 * Wrap a `{ items: T[], pagination: { limit, hasNextPage, nextCursor } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * Used for cursor-paginated list endpoints whose application-service return is
 * a class-instance `{ items, pagination }` DTO. The canonical envelope has to
 * be a plain object (the interceptor's `isFormattedResponse()` guards on
 * `Object` prototype), so we deliberately project out the DTO fields here
 * instead of forwarding the class instance for the interceptor to re-wrap.
 *
 * Implementation note (Phase 2 — audit issue 2.2): delegates to
 * `ApiResponse.page(...)` so the items array passes through
 * `normalizeTemporalFields` exactly once, matching every other
 * paginated endpoint on the wire.
 */
const wrapPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}): ApiResponseEnvelope<T[]> =>
  ApiResponse.page<T>([...payload.items], {
    kind: 'cursor',
    limit: payload.pagination.limit,
    hasNextPage: payload.pagination.hasNextPage,
    nextCursor: payload.pagination.nextCursor,
  });

/**
 * Presenter for the instance module. Wraps every application-service response
 * in the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * The leaderboard endpoint emits the canonical `{ items, pagination }` shape
 * directly from the application service so this presenter falls into the
 * standard cursor pagination path.
 *
 * The `listInstancePlayers` endpoint returns a non-paginated
 * `{ instanceId, items, total }` object, which is wrapped as a single-resource
 * envelope.
 */
@Injectable()
export class InstancePresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Lifecycle endpoints
  readonly createInstance = InstancePresenter.ok<CreateInstanceResponseDto>;
  readonly joinInstance = InstancePresenter.ok<JoinInstanceResponseDto>;
  readonly startInstance = InstancePresenter.ok<StartInstanceResponseDto>;
  readonly closeInstance = InstancePresenter.ok<CloseInstanceResponseDto>;
  // Phase 2 — countdown lifecycle endpoints.
  readonly startCountdown = InstancePresenter.ok<StartCountdownResponseDto>;
  readonly cancelCountdown = InstancePresenter.ok<CancelCountdownResponseDto>;

  // Detail / players
  readonly getInstanceById = InstancePresenter.ok<InstanceDetailResponseDto>;
  readonly listInstancePlayers = InstancePresenter.ok<InstancePlayersResponseDto>;

  // Paginated lists
  readonly listInstances = wrapPaginatedDto<InstanceListResponseDto['items'][number]>;
  readonly getLeaderboard = wrapPaginatedDto<InstanceLeaderboardResponseDto['items'][number]>;
}
