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
 * The `listInstancePlayers` endpoint now uses the canonical cursor
 * pagination path (Phase 6 — api-contract audit) so this presenter
 * follows the same `wrapPaginatedDto` shape as the leaderboard. The
 * legacy `{ instanceId, items, total }` wrapper was removed because
 * (a) `total` is an offset-pagination field and the project standard
 * reserves offset pagination for endpoints without a stable natural
 * sort key, and (b) `instanceId` was redundant with the path parameter.
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
  // Phase 6 (api-contract audit): the players endpoint now uses the
  // canonical cursor-paginated envelope — `data` is the raw player
  // array and `meta.pagination` carries the cursor discriminator.
  readonly listInstancePlayers = wrapPaginatedDto<InstancePlayersResponseDto['items'][number]>;

  // Paginated lists
  readonly listInstances = wrapPaginatedDto<InstanceListResponseDto['items'][number]>;
  readonly getLeaderboard = wrapPaginatedDto<InstanceLeaderboardResponseDto['items'][number]>;
}
