import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TagResponseDto } from './tag-response.dto';

export class TagPaginationResponseDto {
  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;
}

export class TagListResponseDto {
  @ApiProperty({ description: 'Tag items', type: () => [TagResponseDto] })
  items!: TagResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => TagPaginationResponseDto })
  pagination!: TagPaginationResponseDto;
}
