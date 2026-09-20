import { ApiProperty } from '@nestjs/swagger';
import { QuizStatsHistoryPointDto } from './quiz-stats-history-point.dto';

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
