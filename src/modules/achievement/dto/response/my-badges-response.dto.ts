import { ApiProperty } from '@nestjs/swagger';

export class MyBadgeItemDto {
  @ApiProperty({ description: 'Unique badge identifier' })
  badgeId!: string;

  @ApiProperty({ description: 'Badge display name' })
  name!: string;

  @ApiProperty({ nullable: true, description: 'Badge description' })
  description!: string | null;

  @ApiProperty({ description: 'Badge rarity tier' })
  rarity!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp when the user earned this badge' })
  earnedAt!: string;
}

export class MyBadgesResponseDto {
  @ApiProperty({ type: [MyBadgeItemDto], description: 'List of badges earned by the authenticated user' })
  data!: MyBadgeItemDto[];

  @ApiProperty({ description: 'Total count of badges matching the query' })
  total!: number;
}
