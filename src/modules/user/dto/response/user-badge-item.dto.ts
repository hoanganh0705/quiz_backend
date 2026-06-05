import { ApiProperty } from '@nestjs/swagger';

export class UserBadgeItemDto {
  @ApiProperty()
  badgeId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'ISO 8601 timestamp when the user earned this badge' })
  earnedAt!: string;
}
