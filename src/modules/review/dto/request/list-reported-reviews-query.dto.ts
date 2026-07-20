import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { REPORT_STATUS_VALUES } from '../../domain/policies/review-report-status.policy';

export class ListReportedReviewsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination. Pass the `nextCursor` from a previous response.',
    type: String,
    example:
      'eyJjcmVhdGVkQXQiOiAiMjAyNi0wMS0wMVQwMDowMDowMC4wMDBaIiwgInJldmlld0lkIjogIjk5MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–100)',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  // Phase 3 / Issue #7 — allow callers to filter to only `open`
  // reports so users can hide closed reports from their dashboard.
  // Without this, the user's "my reported reviews" list grows
  // monotonically with every dismissal/action and there's no way to
  // find the reports still awaiting moderation. Validated against
  // the policy type so a typo at the controller boundary cannot
  // reach the repository.
  @ApiPropertyOptional({
    description:
      'Filter to a single report status. Pass `open` to surface only reports awaiting moderation.',
    enum: REPORT_STATUS_VALUES,
  })
  @IsOptional()
  @IsIn(REPORT_STATUS_VALUES)
  status?: (typeof REPORT_STATUS_VALUES)[number];
}
