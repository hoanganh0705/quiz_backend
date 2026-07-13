import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizVersionResponseDto } from './quiz-version-response.dto';

/**
 * Slim list-item shape used by listing endpoints.
 *
 * Identical to `QuizResponseDto` except it omits `tags`, because the only
 * UI consumer of tags today is the detail page. Listing endpoints (catalog,
 * category, tag, featured, trending, popular, related, recommendations)
 * stay slim — keeping payload small and avoiding the batched join that
 * would be needed to populate `tags` across a whole page.
 */
export class QuizListItemDto {
  @ApiProperty({
    description: 'Unique quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiPropertyOptional({ description: 'Creator user identifier', type: String, nullable: true })
  creatorId!: string | null;

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
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string | null;

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
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Published version summary (excluded when listing multiple quizzes)',
    type: () => QuizVersionResponseDto,
    nullable: true,
  })
  publishedVersion!: QuizVersionResponseDto | null;
}
