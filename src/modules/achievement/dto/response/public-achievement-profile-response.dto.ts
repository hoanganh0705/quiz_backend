import { ApiProperty } from '@nestjs/swagger';

export class FeaturedBadgeResponseDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_10' })
  badgeId!: string;

  @ApiProperty({ description: 'Badge display name', example: 'Top 10' })
  badgeName!: string;

  @ApiProperty({ description: 'Badge rarity', example: 'epic' })
  rarity!: string;
}

export class PublicAchievementProfileResponseDto {
  @ApiProperty({ description: 'User identifier', example: 'xxx' })
  userId!: string;

  @ApiProperty({ description: 'Total earned badges', example: 25 })
  totalBadges!: number;

  @ApiProperty({ description: 'Number of rare badges earned', example: 3 })
  rareBadges!: number;

  @ApiProperty({
    description: 'Best public rank achieved by the user',
    type: 'number',
    example: 12,
    nullable: true,
  })
  highestRank!: number | null;

  @ApiProperty({
    description: 'Featured badges prioritized by rarity',
    type: FeaturedBadgeResponseDto,
    isArray: true,
  })
  featuredBadges!: FeaturedBadgeResponseDto[];
}
