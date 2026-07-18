import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizVersionResponseDto } from './quiz-version-response.dto';
import { QuizTagDto } from './quiz-tag.dto';

export class QuizResponseDto {
  @ApiProperty({
    description: 'Unique quiz identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
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
    example: '550e8400-e29b-71d4-a716-446655440000',
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
