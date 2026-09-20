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

const wrapPaginatedDto = <T>(payload: {
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

@Injectable()
export class InstancePresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly createInstance = InstancePresenter.ok<CreateInstanceResponseDto>;
  readonly joinInstance = InstancePresenter.ok<JoinInstanceResponseDto>;
  readonly startInstance = InstancePresenter.ok<StartInstanceResponseDto>;
  readonly closeInstance = InstancePresenter.ok<CloseInstanceResponseDto>;
  readonly startCountdown = InstancePresenter.ok<StartCountdownResponseDto>;
  readonly cancelCountdown = InstancePresenter.ok<CancelCountdownResponseDto>;

  readonly getInstanceById = InstancePresenter.ok<InstanceDetailResponseDto>;
  readonly listInstancePlayers = wrapPaginatedDto<InstancePlayersResponseDto['items'][number]>;

  readonly listInstances = wrapPaginatedDto<InstanceListResponseDto['items'][number]>;
  readonly getLeaderboard = wrapPaginatedDto<InstanceLeaderboardResponseDto['items'][number]>;
}
