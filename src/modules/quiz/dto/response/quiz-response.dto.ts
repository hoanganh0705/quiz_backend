import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorSummaryDto } from './author-summary.dto';
import { QuizTagDto } from './quiz-tag.dto';
import { QuizVersionResponseDto } from './quiz-version-response.dto';

/**
 * Detail DTO returned by `GET /quizzes/:id`, `GET /quizzes/:slug`,
 * `POST /quizzes`, and `PATCH /quizzes/:id`.
 *
 * Phase 2 (S-7) adds:
 *   - `creator`       — embedded author summary (same shape as the
 *                       list projection, so the byline reads from a
 *                       single field on both endpoints)
 *   - `categoryName` / `categorySlug` — same JOIN as the list
 *                       projection; the detail page renders a
 *                       "Category: …" link that needs the slug
 *
 * The aggregate fields on the list projection (`questionCount`,
 * `averageRating`, `reviewCount`, `attemptCount`) deliberately do
 * NOT live here — they are sourced from `quiz_stats` and are
 * surfaced through the dedicated `/quizzes/:id/stats` endpoint
 * (see `QuizStatsResponseDto`, enriched in S-10). Keeping the
 * detail DTO focused on `QuizVersionResponseDto`-style content
 * means a future version-control refactor (e.g. separate "author
 * view" vs "player view") does not have to reconcile a stats
 * shadow field.
 */
export class QuizResponseDto {
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
    description: 'Tags attached to the quiz (only populated on detail endpoints)',
    type: () => [QuizTagDto],
  })
  tags!: QuizTagDto[];
}
