import { QuizResponseDto } from './quiz-response.dto';

export class QuizPaginationResponseDto {
  limit!: number;
  nextCursor!: string | null;
  hasNextPage!: boolean;
}

export class QuizListResponseDto {
  items!: QuizResponseDto[];
  pagination!: QuizPaginationResponseDto;
}
