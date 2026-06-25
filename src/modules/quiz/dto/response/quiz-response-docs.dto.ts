import { ApiProperty } from '@nestjs/swagger';
import type { QuizDifficulty, QuizVersionStatus } from '@/modules/quiz/types/quiz.types';

// ─── Quiz module documentation-only wrapper DTOs ───────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp, ...pagination } }
//
// Runtime DTO classes (QuizResponseDto, QuizListResponseDto, etc.) remain unchanged.
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse decorators
// to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Nested data types ─────────────────────────────────────────────────────────

class DeleteMessageDataDto {
  @ApiProperty({
    description: 'Deletion confirmation',
    example: 'Quiz deleted successfully',
  })
  message!: string;
}

class QuizDataDto {
  @ApiProperty({
    description: 'Unique quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Creator user identifier',
    type: String,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  creatorId!: string | null;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  title!: string;

  @ApiProperty({
    description: 'Quiz description',
    type: String,
    nullable: true,
    example: 'Test your knowledge of JavaScript.',
  })
  description!: string | null;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'javascript-fundamentals',
  })
  slug!: string;

  @ApiProperty({
    description: 'Prerequisites',
    type: String,
    nullable: true,
  })
  requirements!: string | null;

  @ApiProperty({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Whether the quiz is featured',
    example: true,
  })
  isFeatured!: boolean;

  @ApiProperty({
    description: 'Whether the quiz is hidden from public listings',
    example: false,
  })
  isHidden!: boolean;

  @ApiProperty({
    description: 'Whether the quiz has been verified by moderators',
    example: false,
  })
  isVerified!: boolean;

  @ApiProperty({
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

  @ApiProperty({
    description: 'Published version summary',
    type: Object,
    nullable: true,
  })
  publishedVersion!: object | null;
}

class QuizQuestionDataDto {
  @ApiProperty({
    description: 'Unique question identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiProperty({
    description: 'Parent quiz version identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Display order (1-based)',
    example: 1,
  })
  position!: number;

  @ApiProperty({
    description: 'Question text',
    example: 'What does `console.log` do in JavaScript?',
  })
  questionText!: string;

  @ApiProperty({
    description: 'Optional image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

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

  @ApiProperty({
    description: 'Answer options',
    type: [Object],
  })
  answerOptions!: object[];
}

class QuizVersionDataDto {
  @ApiProperty({
    description: 'Unique quiz version identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Sequential version number',
    example: 1,
  })
  versionNumber!: number;

  @ApiProperty({
    description: 'Version lifecycle status',
    enum: ['draft', 'published', 'archived'],
    example: 'draft',
  })
  status!: QuizVersionStatus;

  @ApiProperty({
    description: 'Difficulty level',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty!: QuizDifficulty;

  @ApiProperty({
    description: 'Time limit in milliseconds',
    example: 600000,
  })
  durationMs!: number;

  @ApiProperty({
    description: 'Minimum score percent to pass',
    example: 70,
  })
  passingScorePercent!: number;

  @ApiProperty({
    description: 'XP reward for passing',
    example: 100,
  })
  rewardXp!: number;

  @ApiProperty({
    description: 'Creator user identifier',
    type: String,
    nullable: true,
  })
  createdByUserId!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when version was published (ISO 8601)',
    type: String,
    nullable: true,
  })
  publishedAt!: string | null;

  @ApiProperty({
    description: 'Timestamp when version was archived (ISO 8601)',
    type: String,
    nullable: true,
  })
  archivedAt!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

class TrendingQuizItemDataDto {
  @ApiProperty({
    description: 'Trending rank position',
    example: 1,
  })
  rank!: number;

  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  title!: string;

  @ApiProperty({
    description: 'URL-friendly quiz slug',
    example: 'javascript-fundamentals',
  })
  slug!: string;

  @ApiProperty({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Trending score for this period',
    example: 45.2,
  })
  trendingScore!: number;

  @ApiProperty({
    description: 'Total number of attempts',
    example: 1250,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Attempts in the current trending window',
    example: 320,
  })
  recentAttempts!: number;
}

class TrendingDataDto {
  @ApiProperty({
    description: 'Trending period',
    enum: ['daily', 'weekly'],
    example: 'weekly',
  })
  period!: 'daily' | 'weekly';

  @ApiProperty({
    description: 'Trending quiz items sorted by rank',
    type: [TrendingQuizItemDataDto],
  })
  quizzes!: TrendingQuizItemDataDto[];

  @ApiProperty({
    description: 'Timestamp of the last trending refresh (ISO 8601)',
    example: '2025-06-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}

class PopularQuizItemDataDto {
  @ApiProperty({
    description: 'Popularity rank position',
    example: 1,
  })
  rank!: number;

  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  title!: string;

  @ApiProperty({
    description: 'URL-friendly quiz slug',
    example: 'javascript-fundamentals',
  })
  slug!: string;

  @ApiProperty({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Composite popularity score',
    example: 87.6,
  })
  popularityScore!: number;

  @ApiProperty({
    description: 'Total number of attempts',
    example: 1250,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Average user rating (1–5)',
    example: 4.3,
  })
  averageRating!: number;

  @ApiProperty({
    description: 'Number of bookmarks',
    example: 95,
  })
  bookmarkCount!: number;
}

class PopularDataDto {
  @ApiProperty({
    description: 'Popular quiz items sorted by rank',
    type: [PopularQuizItemDataDto],
  })
  quizzes!: PopularQuizItemDataDto[];

  @ApiProperty({
    description: 'Timestamp of the last popularity refresh (ISO 8601)',
    example: '2025-06-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}

class CreatorAnalyticsDataDto {
  @ApiProperty({
    description: 'Creator user identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Total quizzes created by the creator',
    example: 12,
  })
  totalQuizzes!: number;

  @ApiProperty({
    description: 'Total draft quizzes owned by the creator',
    example: 3,
  })
  draftQuizzes!: number;

  @ApiProperty({
    description: 'Total published quizzes owned by the creator',
    example: 9,
  })
  publishedQuizzes!: number;

  @ApiProperty({
    description: 'Total attempts across all creator quizzes',
    example: 4800,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Total unique players across all creator quizzes',
    example: 2900,
  })
  totalPlayers!: number;

  @ApiProperty({
    description: 'Average score across all creator quizzes (0–100)',
    example: 76.4,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Average rating across all creator quizzes (1–5)',
    example: 4.4,
  })
  averageRating!: number;

  @ApiProperty({
    description: 'Total bookmarks across all creator quizzes',
    example: 510,
  })
  totalBookmarks!: number;

  @ApiProperty({
    description: 'Total reviews across all creator quizzes',
    example: 310,
  })
  totalReviews!: number;

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh (ISO 8601)',
    example: '2025-06-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}

class QuizStatsDataDto {
  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Total number of attempts',
    example: 1240,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Number of unique players who attempted the quiz',
    example: 830,
  })
  totalPlayers!: number;

  @ApiProperty({
    description: 'Average score percent across all attempts (0–100)',
    example: 78.4,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Average user rating (1–5)',
    example: 4.6,
  })
  averageRating!: number;

  @ApiProperty({
    description: 'Number of times the quiz has been bookmarked',
    example: 95,
  })
  bookmarkCount!: number;

  @ApiProperty({
    description: 'Proportion of attempts that reached the end (0–1)',
    example: 86.5,
  })
  completionRate!: number;

  @ApiProperty({
    description: 'Composite popularity score',
    example: 91.2743,
  })
  popularityScore!: number;

  @ApiProperty({
    description: 'Short-term trending score based on recent activity',
    example: 43.1182,
  })
  trendingScore!: number;
}

class RelatedQuizzesDataDto {
  @ApiProperty({
    description: 'Related quiz items',
    type: [QuizDataDto],
  })
  items!: QuizDataDto[];
}

// ─── Meta types ────────────────────────────────────────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class PaginationMetaDataDto {
  @ApiProperty({
    description: 'Number of items returned in this page',
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({
    description: 'Whether more items exist after this page',
    example: true,
  })
  hasNextPage!: boolean;
}

class PaginatedMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Cursor-based pagination metadata',
    type: () => PaginationMetaDataDto,
  })
  pagination!: PaginationMetaDataDto;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

export class WrappedMessageDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: () => DeleteMessageDataDto,
  })
  data!: DeleteMessageDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedQuizResponseDto {
  @ApiProperty({
    description: 'Wrapped quiz details',
    type: () => QuizDataDto,
  })
  data!: QuizDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedQuizListDto {
  @ApiProperty({
    description: 'Paginated quiz items',
    type: () => [QuizDataDto],
  })
  data!: QuizDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: () => PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}

export class WrappedQuizQuestionDto {
  @ApiProperty({
    description: 'Wrapped question details',
    type: () => QuizQuestionDataDto,
  })
  data!: QuizQuestionDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedQuizQuestionArrayDto {
  @ApiProperty({
    description: 'Wrapped question details',
    isArray: true,
    type: () => QuizQuestionDataDto,
  })
  data!: QuizQuestionDataDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedQuizVersionResponseDto {
  @ApiProperty({
    description: 'Wrapped quiz version details',
    type: () => QuizVersionDataDto,
  })
  data!: QuizVersionDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedQuizVersionListDto {
  @ApiProperty({
    description: 'Paginated quiz version items',
    type: () => [QuizVersionDataDto],
  })
  data!: QuizVersionDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: () => PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}

export class WrappedTrendingQuizzesDto {
  @ApiProperty({
    description: 'Wrapped trending quizzes',
    type: () => TrendingDataDto,
  })
  data!: TrendingDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedPopularQuizzesDto {
  @ApiProperty({
    description: 'Wrapped popular quizzes',
    type: () => PopularDataDto,
  })
  data!: PopularDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedCreatorAnalyticsDto {
  @ApiProperty({
    description: 'Wrapped creator analytics',
    type: () => CreatorAnalyticsDataDto,
  })
  data!: CreatorAnalyticsDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedQuizStatsDto {
  @ApiProperty({
    description: 'Wrapped quiz statistics',
    type: () => QuizStatsDataDto,
  })
  data!: QuizStatsDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class WrappedRelatedQuizzesDto {
  @ApiProperty({
    description: 'Wrapped related quizzes',
    type: () => RelatedQuizzesDataDto,
  })
  data!: RelatedQuizzesDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}
