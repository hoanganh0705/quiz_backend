import { ApiProperty } from '@nestjs/swagger';
import { QuizResponseDto } from './quiz-response.dto';
import { QuizStatsResponseDto } from './quiz-stats-response.dto';
import { QuizStatsHistoryResponseDto } from './quiz-stats-history-response.dto';
import { QuizQuestionPlayerDto } from './quiz-question-player.dto';

/**
 * `QuizAggregateResponseDto` — Phase 4 (S-24) bundle returned by
 * `GET /quizzes/:id/aggregate`.
 *
 * The quiz detail page used to issue 5+ sequential calls (quiz,
 * stats, stats history, preview questions, etc.). The aggregate
 * collapses the fan-out into a single round-trip by parallelising
 * the sub-queries.
 *
 * ## Stability
 *
 *   - `quiz`              — full quiz (with published version)
 *   - `stats`             — quiz stats (cached snapshot)
 *   - `statsHistory`      — bucketed stats timeline
 *   - `previewQuestions`  — first N questions (player-style)
 *
 * The publish event `quiz.updated` invalidates the cached bundle
 * (60s Redis TTL + event-driven invalidation).
 */
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
