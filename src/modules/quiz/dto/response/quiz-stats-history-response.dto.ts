import { ApiProperty } from '@nestjs/swagger';
import { QuizStatsHistoryPointDto } from './quiz-stats-history-point.dto';

/**
 * Phase 2 (S-11): response for `GET /quizzes/:id/stats/history`.
 *
 * Bucketed timeline of `quiz_attempts` for the quiz, used by the
 * stats panel's longer-range charts. The frontend chooses the
 * bucket and range via query params; the server densifies gaps so
 * the client renders a continuous chart without further math.
 */
export class QuizStatsHistoryResponseDto {
  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({
    description: 'Range echoed back as performed',
    example: '30d',
    enum: ['7d', '30d'],
  })
  range!: '7d' | '30d';

  @ApiProperty({
    description: 'Bucket size echoed back as performed',
    example: 'day',
    enum: ['day', 'hour'],
  })
  bucket!: 'day' | 'hour';

  @ApiProperty({
    description: 'Bucketed timeline points (gaps filled with zeros)',
    type: () => [QuizStatsHistoryPointDto],
  })
  points!: QuizStatsHistoryPointDto[];
}
