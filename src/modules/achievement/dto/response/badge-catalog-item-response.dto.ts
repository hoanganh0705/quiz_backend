import { ApiProperty } from '@nestjs/swagger';

export class BadgeCatalogItemResponseDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_10' })
  id!: string;

  @ApiProperty({ description: 'Badge display name', example: 'Top 10' })
  name!: string;

  @ApiProperty({
    description: 'Badge description',
    type: 'string',
    example: 'Reach Top 10 ranking',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ description: 'Badge rarity', example: 'epic' })
  rarity!: string;

  @ApiProperty({ description: 'Total number of users who earned this badge', example: 1243 })
  earnedCount!: number;
}
