import { ApiProperty } from '@nestjs/swagger';
import { QuizResponseDto } from './quiz-response.dto';

export class RelatedQuizzesResponseDto {
  @ApiProperty({ description: 'Related quiz items', type: () => [QuizResponseDto] })
  items!: QuizResponseDto[];
}
