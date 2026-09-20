import { ApiProperty } from '@nestjs/swagger';
import { InstancePlayerResponseDto } from './instance-player-response.dto';

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
