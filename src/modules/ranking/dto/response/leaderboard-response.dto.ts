import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiOptionalTimestampProperty } from '@/common/decorators/api-uuid-property.decorator';
import {
  LeaderboardEntryDto,
  PeriodInfoDto,
  PaginationDto,
  UserRankPositionDto,
  GlobalRankingDto,
  UserBadgesDto,
} from './leaderboard-entry.dto';
import { PeakRanksResponseDto } from './leaderboard-history.dto';

export class LeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard entries',
    type: () => [LeaderboardEntryDto],
  })
  entries!: LeaderboardEntryDto[];

  @ApiProperty({
    description: 'Total number of participants in this ranking',
    example: 1542,
  })
  totalParticipants!: number;

  @ApiPropertyOptional({
    description: 'Current user position (if authenticated)',
    type: () => UserRankPositionDto,
    nullable: true,
  })
  userPosition!: UserRankPositionDto | null;

  @ApiProperty({
    description: 'Period information',
    type: () => PeriodInfoDto,
  })
  period!: PeriodInfoDto;

  @ApiProperty({
    description: 'Pagination information',
    type: () => PaginationDto,
  })
  pagination!: PaginationDto;
}

export class UserRankResponseDto {
  @ApiProperty({
    description: 'Global rankings across all periods',
    type: () => GlobalRankingDto,
  })
  global!: GlobalRankingDto;

  @ApiProperty({
    description: 'Best ranks ever achieved (rank + when they were achieved)',
    type: () => PeakRanksResponseDto,
  })
  peakRanks!: PeakRanksResponseDto;

  @ApiOptionalTimestampProperty({
    description: 'Last activity timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  lastActivityAt!: string | null;

  @ApiProperty({
    description: 'User ranking badges',
    type: () => UserBadgesDto,
  })
  badges!: UserBadgesDto;
}
