import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorSummaryDto } from './author-summary.dto';
import { QuizTagDto } from './quiz-tag.dto';
import { QuizVersionResponseDto } from './quiz-version-response.dto';

/**
 * List-item shape used by listing endpoints.
 *
 * Phase 2 (S-6) enriched this DTO from a minimal projection to a
 * self-contained card payload:
 *   - `creator`       — embedded author summary (no second round-trip)
 *   - `categoryName` / `categorySlug` — resolved via JOIN on the
 *                       category so the card can render a category link
 *   - `questionCount` — total question count for the published version
 *                       (0 when no published version exists)
 *   - `averageRating` — pre-computed by `quiz_stats` so the card does
 *                       not have to fetch review aggregates separately
 *   - `reviewCount`   — same source as `averageRating`
 *   - `attemptCount`  — total `quiz_attempts` for this quiz, sourced
 *                       from `quiz_stats.total_attempts`
 *   - `tags`          — folded in from the detail-only path so the
 *                       card can render tag chips without a separate
 *                       fetch (the batched join was already batched
 *                       behind a sub-select — see `getTagsForQuizIds`)
 *
 * The card payload stays slim by sourcing the aggregates from the
 * denormalised `quiz_stats` table; no per-row aggregation runs at
 * request time.
 */
export class QuizListItemDto {
  @ApiProperty({
    description: 'Unique quiz identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiPropertyOptional({ description: 'Creator user identifier', type: String, nullable: true })
  creatorId!: string | null;

  @ApiProperty({
    description: 'Embedded author summary',
    type: () => AuthorSummaryDto,
    nullable: true,
  })
  creator!: AuthorSummaryDto | null;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiPropertyOptional({ description: 'Quiz description', type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'URL-friendly slug', example: 'javascript-fundamentals' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Prerequisites', type: String, nullable: true })
  requirements!: string | null;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiPropertyOptional({
    description:
      'Associated category identifier (singular — each quiz belongs to at most one category)',
    type: String,
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  categoryId!: string | null;

  @ApiPropertyOptional({
    description: 'Resolved category display name',
    type: String,
    nullable: true,
    example: 'Web Development',
  })
  categoryName!: string | null;

  @ApiPropertyOptional({
    description: 'Resolved category URL-friendly slug',
    type: String,
    nullable: true,
    example: 'web-development',
  })
  categorySlug!: string | null;

  @ApiProperty({ description: 'Whether the quiz is featured', example: true })
  isFeatured!: boolean;

  @ApiProperty({ description: 'Whether the quiz is hidden from public listings', example: false })
  isHidden!: boolean;

  @ApiProperty({ description: 'Whether the quiz has been verified by moderators', example: false })
  isVerified!: boolean;

  @ApiPropertyOptional({
    description: 'Currently published version identifier',
    type: String,
    nullable: true,
  })
  publishedVersionId!: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-07-13 09:11:05.026+00',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-07-13 09:11:05.026+00',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Published version summary (excluded when listing multiple quizzes)',
    type: () => QuizVersionResponseDto,
    nullable: true,
  })
  publishedVersion!: QuizVersionResponseDto | null;

  @ApiProperty({
    description:
      'Total question count for the published version. `0` when the quiz has no ' +
      'published version. Sourced from `quiz_questions` aggregated by `quiz_version_id`.',
    example: 12,
  })
  questionCount!: number;

  @ApiProperty({
    description:
      'Average review rating (0–5). `0` when there are no reviews. ' +
      'Sourced from the denormalised `quiz_stats.avg_rating` column.',
    example: 4.3,
  })
  averageRating!: number;

  @ApiProperty({
    description: 'Number of submitted reviews. Sourced from `quiz_stats.rating_count`.',
    example: 312,
  })
  reviewCount!: number;

  @ApiProperty({
    description:
      'Total attempts across every version of this quiz. ' +
      'Sourced from `quiz_stats.total_attempts`; counts both completed and in-flight attempts.',
    example: 1240,
  })
  attemptCount!: number;

  @ApiProperty({
    description:
      'Tags attached to the quiz. Phase 2 (S-6) folds the tag batch into the list ' +
      'projection so cards can render tag chips without a second fetch.',
    type: () => [QuizTagDto],
  })
  tags!: QuizTagDto[];
}
