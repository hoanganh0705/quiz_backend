import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowedCategoryItemDto {
  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'ISO 8601 timestamp when the user followed this category' })
  followedAt!: string;
}
