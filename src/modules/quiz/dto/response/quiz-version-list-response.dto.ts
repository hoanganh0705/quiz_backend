import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizVersionResponseDto } from './quiz-version-response.dto';

export class QuizVersionPaginationResponseDto {
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

export class QuizVersionListResponseDto {
  @ApiProperty({ description: 'Quiz version items', type: () => [QuizVersionResponseDto] })
  items!: QuizVersionResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => QuizVersionPaginationResponseDto })
  pagination!: QuizVersionPaginationResponseDto;
}
