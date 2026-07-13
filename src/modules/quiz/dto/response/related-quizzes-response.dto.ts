import { ApiProperty } from '@nestjs/swagger';
import { QuizListItemDto } from './quiz-list-item.dto';

export class RelatedQuizzesResponseDto {
  @ApiProperty({ description: 'Related quiz items', type: () => [QuizListItemDto] })
  items!: QuizListItemDto[];
}
