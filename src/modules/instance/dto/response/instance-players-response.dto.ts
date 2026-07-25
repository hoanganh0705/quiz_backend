import { ApiProperty } from '@nestjs/swagger';
import { InstancePlayerResponseDto } from './instance-player-response.dto';

/**
 * Phase 6 (api-contract audit) — the players endpoint now uses the
 * canonical cursor-paginated envelope. The response DTO is the wrapper
 * shape `{ items, pagination }` that the presenter converts to the
 * envelope `{ data: ItemDto[], meta: { timestamp, pagination } }` via
 * `ApiResponse.page(...)`. The legacy `{ instanceId, items, total }`
 * shape was removed because:
 *
 *   - `total` is an offset-pagination field; the project standard
 *     (`docs/standards/api.md`) reserves offset pagination for endpoints
 *     without a stable natural sort key, and the players list is sorted
 *     by `(joinedAt ASC, instancePlayerId ASC)` — a stable sort key.
 *   - `instanceId` was redundant: clients already know the parent
 *     instance id (it is the path parameter).
 *
 * The `pagination` block is the same `kind: 'cursor'` discriminated
 * shape used by `/instances` and `/instances/{id}/leaderboard`.
 */
export class InstancePlayersPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether more players exist beyond this page', example: true })
  hasNextPage!: boolean;

  @ApiProperty({
    description:
      'Base64URL-encoded cursor for fetching the next page. `null` when there is no next page. ' +
      'Decoded payload: `{ joinedAt: string, instancePlayerId: string }`.',
    type: String,
    nullable: true,
    example:
      'eyJqb2luZWRBdCI6IjIwMjYtMDYtMjVUMTA6MzA6MDAuMDAwWiIsImluc3RhbmNlUGxheWVySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwOTkifQ',
  })
  nextCursor!: string | null;
}

export class InstancePlayersResponseDto {
  @ApiProperty({
    description: 'Players in the instance (sorted by join time, ascending)',
    type: () => [InstancePlayerResponseDto],
  })
  items!: InstancePlayerResponseDto[];

  @ApiProperty({
    description: 'Cursor-based pagination metadata',
    type: () => InstancePlayersPaginationDto,
  })
  pagination!: InstancePlayersPaginationDto;
}
