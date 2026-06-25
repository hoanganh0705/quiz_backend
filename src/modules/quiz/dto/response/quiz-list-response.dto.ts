import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizResponseDto } from './quiz-response.dto';

export class QuizPaginationResponseDto {
  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;
}

export class QuizListResponseDto {
  @ApiProperty({ description: 'Quiz items', type: () => [QuizResponseDto] })
  items!: QuizResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => QuizPaginationResponseDto })
  pagination!: QuizPaginationResponseDto;
}
