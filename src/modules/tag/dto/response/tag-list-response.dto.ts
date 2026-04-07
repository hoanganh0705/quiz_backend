import { TagResponseDto } from './tag-response.dto';

export class TagPaginationResponseDto {
  limit!: number;
  nextCursor!: string | null;
  hasNextPage!: boolean;
}

export class TagListResponseDto {
  items!: TagResponseDto[];
  pagination!: TagPaginationResponseDto;
}
