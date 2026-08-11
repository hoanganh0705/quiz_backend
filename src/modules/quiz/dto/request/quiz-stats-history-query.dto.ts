import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

/**
 * Phase 2 (S-11): query params for `GET /quizzes/:id/stats/history`.
 *
 *   - `range`  — temporal window. `7d` (default) returns a 7-bucket
 *                hourly timeline when `bucket=hour`, otherwise
 *                daily. `30d` returns a 30-day daily timeline.
 *   - `bucket` — granular size. `day` (default) is one entry per
 *                calendar day. `hour` is one entry per hour.
 *
 * The defaults match the values the audit recommended for the home
 * page stats widget: a 30-day daily timeline with hour-grained
 * zoom-in reserved for a future drill-down view.
 */
export class QuizStatsHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Window length',
    example: '30d',
    default: '30d',
    enum: ['7d', '30d'],
  })
  @IsOptional()
  @IsIn(['7d', '30d'])
  range?: '7d' | '30d' = '30d';

  @ApiPropertyOptional({
    description: 'Bucket size',
    example: 'day',
    default: 'day',
    enum: ['day', 'hour'],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['day', 'hour'])
  bucket?: 'day' | 'hour' = 'day';
}
