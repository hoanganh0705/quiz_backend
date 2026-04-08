import { QuizVersionResponseDto } from './quiz-version-response.dto';

export class QuizVersionPaginationResponseDto {
  limit!: number;
  nextCursor!: string | null;
  hasNextPage!: boolean;
}

export class QuizVersionListResponseDto {
  items!: QuizVersionResponseDto[];
  pagination!: QuizVersionPaginationResponseDto;
}
