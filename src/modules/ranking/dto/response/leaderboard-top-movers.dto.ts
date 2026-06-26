import { ApiProperty } from '@nestjs/swagger';

export class TopMoverDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Public username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Current snapshot rank', example: 34 })
  currentRank!: number;

  @ApiProperty({ description: 'Previous snapshot rank', example: 454 })
  previousRank!: number;

  @ApiProperty({
    description: 'Positive rank change computed as previousRank - currentRank',
    example: 420,
  })
  change!: number;
}

export class TopMoversResponseDto {
  @ApiProperty({
    description: 'Users with the largest positive ranking movement',
    type: () => [TopMoverDto],
  })
  items!: TopMoverDto[];
}
