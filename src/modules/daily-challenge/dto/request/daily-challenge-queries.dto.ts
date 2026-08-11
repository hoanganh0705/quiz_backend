import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Phase 3 (S-14): cursor + limit for `GET /daily-challenge/history`.
 */
export class DailyChallengeHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    example:
      'eyJkYXRlIjoiMjAyNi0wOC0wOVQwMDowMDowMC4wMDBaIiwiaWQiOiI3NzBlODQwMC0yZTJiLTcxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Page size',
    minimum: 1,
    maximum: 100,
    default: 5,
    example: 5,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * Phase 3 (S-14): period discriminator for `GET /daily-challenge/leaderboard`.
 */
export class DailyChallengeLeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Aggregation period',
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
    example: 'daily',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  period?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Phase 3 (S-14): body for `POST /daily-challenge/answer`.
 *
 * The endpoint is stateful — the server tracks the in-flight
 * attempt and only resolves `correct` against the question at
 * `questionIndex`. Submitting an answer for a different index
 * after the attempt has already advanced returns 409 (out of
 * sync).
 */
export class DailyChallengeAnswerDto {
  @ApiProperty({
    description: '0-indexed position of the question being answered',
    example: 0,
  })
  questionIndex!: number;

  @ApiPropertyOptional({
    description: 'Selected option identifier (UUIDv7) — null for skipped questions',
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  selectedOptionId?: string | null;
}

export { DailyChallengeAnswerDto as DailyChallengeAnswerQueryDto };
