import { ApiProperty } from '@nestjs/swagger';
import { QuizResponseDto } from './quiz-response.dto';
import { QuizStatsResponseDto } from './quiz-stats-response.dto';
import { QuizStatsHistoryResponseDto } from './quiz-stats-history-response.dto';
import { QuizQuestionPlayerDto } from './quiz-question-player.dto';

export class QuizAggregateResponseDto {
  @ApiProperty({
    description: 'Full quiz record (with published version when available)',
    type: () => QuizResponseDto,
  })
  quiz!: QuizResponseDto;

  @ApiProperty({
    description: 'Quiz stats (cached counter snapshot)',
    type: () => QuizStatsResponseDto,
  })
  stats!: QuizStatsResponseDto;

  @ApiProperty({
    description: 'Bucketed stats timeline (sparkline)',
    type: () => QuizStatsHistoryResponseDto,
  })
  statsHistory!: QuizStatsHistoryResponseDto;

  @ApiProperty({
    description: 'First N questions (player-style preview)',
    type: () => [QuizQuestionPlayerDto],
  })
  previewQuestions!: QuizQuestionPlayerDto[];
}
