import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TournamentWinnerDto {
  @ApiProperty({ description: 'Final rank', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Final score', example: 980 })
  score!: number;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class TournamentWinnersResponseDto {
  @ApiProperty({ description: 'Final winners list', type: () => [TournamentWinnerDto] })
  items!: TournamentWinnerDto[];
}
