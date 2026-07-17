import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiUuidProperty } from '@/common/decorators/api-uuid-property.decorator';

export class NearbyRankEntryDto {
  @ApiProperty({ description: 'User rank position', example: 50 })
  rank!: number;

  @ApiUuidProperty({ description: 'User identifier' })
  userId!: string;

  @ApiProperty({ description: 'Public username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Experience points in the selected period', example: 12450 })
  xp!: number;
}

export class NearbyRanksResponseDto {
  @ApiProperty({
    description: 'Entries immediately above the authenticated user',
    type: () => [NearbyRankEntryDto],
  })
  above!: NearbyRankEntryDto[];

  @ApiPropertyOptional({
    description: 'Authenticated user entry',
    type: () => NearbyRankEntryDto,
    nullable: true,
  })
  me!: NearbyRankEntryDto | null;

  @ApiProperty({
    description: 'Entries immediately below the authenticated user',
    type: () => [NearbyRankEntryDto],
  })
  below!: NearbyRankEntryDto[];
}
