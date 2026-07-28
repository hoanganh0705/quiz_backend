import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@/common/responses/pagination';
import { TagResponseDto } from './tag-response.dto';

export class TagListResponseDto {
  @ApiProperty({ description: 'Tag items', type: () => [TagResponseDto] })
  items!: TagResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => CursorPagination })
  pagination!: CursorPagination;
}
