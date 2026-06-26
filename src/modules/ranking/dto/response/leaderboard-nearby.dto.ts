import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NearbyRankEntryDto {
  @ApiProperty({ description: 'User rank position', example: 50 })
  rank!: number;

  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
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
