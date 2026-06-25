import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowedCategoryItemDto {
  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'ISO 8601 timestamp when the user followed this category' })
  followedAt!: string;
}
