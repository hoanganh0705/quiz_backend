import { ApiProperty } from '@nestjs/swagger';
import { ThreadDto } from './thread-response.dto';
import { CommentWithRepliesDto } from './comment-response.dto';

export class PaginatedThreadsDto {
  @ApiProperty({ description: 'Thread page items', type: () => [ThreadDto] })
  items!: ThreadDto[];

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;
}

export class PaginatedCommentsDto {
  @ApiProperty({ description: 'Comment page items', type: () => [CommentWithRepliesDto] })
  items!: CommentWithRepliesDto[];

  @ApiProperty({ description: 'Whether another page is available', example: false })
  hasNextPage!: boolean;
}
