import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── User documentation-only wrapper DTOs ───────────────────────────────────────
//
// ResponseFormatInterceptor wraps every successful response as:
//   { data: <raw_response>, meta: { timestamp: string, ...pagination? } }
//
// For paginated responses (badges, activity, tournaments, tournament-history),
// the interceptor moves the `pagination` field into `meta.pagination` and
// promotes `items` to the top-level `data` field.
//
// The controller still returns the raw DTOs (UserMeResponseDto,
// UserBadgesResponseDto, MyTournamentHistoryResponseDto, etc.) and these
// wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse decorators
// to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Meta ─────────────────────────────────────────────────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class PaginationMetaDto extends MetaDto {
  @ApiPropertyOptional({
    description: 'Cursor-based pagination metadata',
    example: {
      limit: 20,
      hasNextPage: true,
      nextCursor: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiJ9',
    },
  })
  pagination?: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

// ─── Nested data types ───────────────────────────────────────────────────────────

class UserMeDataDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiProperty({ description: 'Email address', example: 'alice@example.com' })
  email!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    nullable: true,
    example: 'Alice',
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    nullable: true,
    example: 'https://example.com/avatars/alice.jpg',
  })
  avatarUrl!: string | null;

  @ApiPropertyOptional({
    description: 'User bio',
    type: String,
    nullable: true,
    example: 'Quiz enthusiast',
  })
  bio!: string | null;

  @ApiProperty({ description: 'Total experience points earned', example: 15420 })
  xpTotal!: number;

  @ApiProperty({ description: 'Current daily quiz streak', example: 7 })
  currentStreak!: number;

  @ApiProperty({ description: 'Longest daily quiz streak ever', example: 14 })
  longestStreak!: number;

  @ApiProperty({
    description: 'User preferences',
    example: { theme: 'dark', notifications: true },
  })
  settings!: Record<string, unknown>;

  @ApiProperty({
    description: 'Account creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last profile update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

class UserActivityItemDataDto {
  @ApiProperty({
    description: 'Activity event identifier',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  eventId!: string;

  @ApiProperty({
    description: 'Activity event type',
    enum: [
      'attempt_completed',
      'achievement_awarded',
      'tournament_joined',
      'tournament_completed',
      'tournament_won',
      'rank_improved',
      'rank_milestone',
      'streak_milestone',
    ],
    example: 'attempt_completed',
  })
  eventType!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the activity event was created',
    example: '2026-06-25T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Event-specific metadata payload',
    type: 'object',
    additionalProperties: true,
    example: { quizId: '660e8400-e29b-41d4-a716-446655440000', score: 88 },
  })
  metadata!: Record<string, unknown>;
}

class UserBadgeItemDataDto {
  @ApiProperty({ description: 'Badge identifier', example: 'b9d6f3a0-7d6e-4d6c-b4d2-1a4f6b2aef90' })
  badgeId!: string;

  @ApiProperty({ description: 'Badge name', example: 'Quiz Master' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Badge description',
    type: String,
    nullable: true,
    example: 'Earned by completing 100 quizzes with a score above 90%.',
  })
  description!: string | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the user earned this badge',
    example: '2026-05-12T14:18:00.000Z',
  })
  earnedAt!: string;
}

class UserRankingDataDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiPropertyOptional({
    description: 'User global all-time rank position (1-based)',
    type: Number,
    nullable: true,
    example: 42,
  })
  globalRank!: number | null;

  @ApiProperty({ description: 'User total score based on all-time XP', example: 15420 })
  totalScore!: number;

  @ApiProperty({ description: 'Derived user level from total score', example: 14 })
  level!: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp when ranking was last updated',
    example: '2026-06-25T10:30:00.000Z',
  })
  updatedAt!: string;
}

class UserAnalyticsSummaryDataDto {
  @ApiProperty({ description: 'Total quiz attempts by the user', example: 420 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Completed quizzes', example: 310 })
  completedQuizzes!: number;

  @ApiProperty({ description: 'Average score percent across attempts', example: 83.5 })
  averageScore!: number;
}

class UserAnalyticsFavoriteCategoryDataDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;
}

class UserAnalyticsFavoriteTagDataDto {
  @ApiProperty({
    description: 'Tag identifier',
    format: 'uuid',
    example: '770e8400-e29b-41d4-a716-446655440111',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;
}

class UserAnalyticsDataDto {
  @ApiProperty({
    description: 'Unique user identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Aggregate summary metrics',
    type: () => UserAnalyticsSummaryDataDto,
  })
  summary!: UserAnalyticsSummaryDataDto;

  @ApiPropertyOptional({
    description: 'Most-engaged category (null if user has no activity)',
    type: () => UserAnalyticsFavoriteCategoryDataDto,
    nullable: true,
  })
  favoriteCategory!: UserAnalyticsFavoriteCategoryDataDto | null;

  @ApiPropertyOptional({
    description: 'Most-engaged tag (null if user has no activity)',
    type: () => UserAnalyticsFavoriteTagDataDto,
    nullable: true,
  })
  favoriteTag!: UserAnalyticsFavoriteTagDataDto | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the last analytics refresh',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}

class MyTournamentItemDataDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Spring Challenge' })
  name!: string;

  @ApiProperty({
    description: 'Tournament lifecycle status',
    enum: ['upcoming', 'registration', 'ongoing', 'finished', 'cancelled'],
    example: 'upcoming',
  })
  status!: 'upcoming' | 'registration' | 'ongoing' | 'finished' | 'cancelled';

  @ApiProperty({
    description: 'Timestamp when the user registered for or first participated in the tournament',
    example: '2026-06-01T00:00:00.000Z',
  })
  registeredAt!: string;

  @ApiProperty({
    description: 'Tournament start timestamp (ISO 8601)',
    example: '2026-06-05T00:00:00.000Z',
  })
  startAt!: string;

  @ApiProperty({
    description: 'Tournament end timestamp (ISO 8601)',
    example: '2026-06-10T00:00:00.000Z',
  })
  endAt!: string;
}

class MyTournamentHistoryItemDataDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Spring Challenge' })
  tournamentName!: string;

  @ApiPropertyOptional({
    description: 'Final rank achieved by the authenticated user',
    type: Number,
    nullable: true,
    example: 12,
  })
  rank!: number | null;

  @ApiProperty({ description: 'Final score achieved by the authenticated user', example: 540 })
  score!: number;

  @ApiProperty({ description: 'Number of participants who finished the tournament', example: 523 })
  participantCount!: number;

  @ApiProperty({
    description: 'Timestamp when the tournament was completed',
    example: '2026-06-01T00:00:00.000Z',
  })
  completedAt!: string;
}

class MyTournamentAnalyticsDataDto {
  @ApiProperty({ description: 'Completed tournaments participated in', example: 45 })
  tournamentsPlayed!: number;

  @ApiProperty({ description: 'Number of tournament wins', example: 6 })
  wins!: number;

  @ApiProperty({ description: 'Number of top 3 finishes', example: 11 })
  top3Finishes!: number;

  @ApiProperty({ description: 'Number of top 10 finishes', example: 18 })
  top10Finishes!: number;

  @ApiPropertyOptional({
    description: 'Average final rank across completed tournaments',
    type: Number,
    nullable: true,
    example: 21,
  })
  averageRank!: number | null;

  @ApiPropertyOptional({
    description: 'Best final rank achieved',
    type: Number,
    nullable: true,
    example: 1,
  })
  bestRank!: number | null;

  @ApiProperty({ description: 'Average final score across completed tournaments', example: 84 })
  averageScore!: number;

  @ApiProperty({ description: 'Total final tournament score', example: 12540 })
  totalTournamentScore!: number;

  @ApiProperty({ description: 'Completion rate percentage', example: 91 })
  completionRate!: number;

  @ApiPropertyOptional({
    description: 'Most recent completed tournament timestamp (ISO 8601)',
    type: String,
    nullable: true,
    example: '2026-06-01T00:00:00.000Z',
  })
  lastTournamentAt!: string | null;
}

class PublicTournamentProfileDataDto {
  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'Number of completed tournaments participated in', example: 32 })
  tournamentsPlayed!: number;

  @ApiProperty({ description: 'Number of completed tournaments won', example: 4 })
  tournamentsWon!: number;

  @ApiPropertyOptional({
    description: 'Best final rank achieved',
    type: Number,
    nullable: true,
    example: 1,
  })
  bestRank!: number | null;

  @ApiPropertyOptional({
    description: 'Average final rank across completed tournaments',
    type: Number,
    nullable: true,
    example: 18,
  })
  averageRank!: number | null;

  @ApiProperty({ description: 'Number of top 10 finishes', example: 12 })
  top10Finishes!: number;

  @ApiProperty({
    description: 'Total final tournament score across completed tournaments',
    example: 15420,
  })
  totalTournamentScore!: number;

  @ApiPropertyOptional({
    description: 'Most recent completed tournament timestamp (ISO 8601)',
    type: String,
    nullable: true,
    example: '2026-06-01T00:00:00.000Z',
  })
  lastTournamentAt!: string | null;
}

class QuizListItemDataDto {
  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'URL-friendly quiz slug', example: 'javascript-fundamentals' })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
    example: 'https://example.com/covers/js.png',
  })
  imageUrl!: string | null;
}

class CreatorQuizAnalyticsDataDto {
  @ApiProperty({
    description: 'Creator user identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Total quizzes created by the creator', example: 12 })
  totalQuizzes!: number;

  @ApiProperty({ description: 'Total draft quizzes owned by the creator', example: 3 })
  draftQuizzes!: number;

  @ApiProperty({ description: 'Total published quizzes owned by the creator', example: 9 })
  publishedQuizzes!: number;

  @ApiProperty({ description: 'Total attempts across all creator quizzes', example: 4800 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Total unique players across all creator quizzes', example: 2900 })
  totalPlayers!: number;

  @ApiProperty({ description: 'Average score across all creator quizzes (0–100)', example: 76.4 })
  averageScore!: number;

  @ApiProperty({ description: 'Average rating across all creator quizzes (1–5)', example: 4.4 })
  averageRating!: number;

  @ApiProperty({ description: 'Total bookmarks across all creator quizzes', example: 510 })
  totalBookmarks!: number;

  @ApiProperty({ description: 'Total reviews across all creator quizzes', example: 310 })
  totalReviews!: number;

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh (ISO 8601)',
    example: '2025-06-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}

// ─── Wrapper DTOs ────────────────────────────────────────────────────────────────

export class UserWrappedMeDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => UserMeDataDto })
  data!: UserMeDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

export class UserWrappedActivityDto {
  @ApiProperty({
    description: 'Wrapped response payload (cursor-paginated activity items)',
    type: () => [UserActivityItemDataDto],
  })
  data!: UserActivityItemDataDto[];

  @ApiProperty({
    description: 'Response metadata including pagination',
    type: () => PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}

export class UserWrappedBadgesDto {
  @ApiProperty({
    description: 'Wrapped response payload (cursor-paginated badge items)',
    type: () => [UserBadgeItemDataDto],
  })
  data!: UserBadgeItemDataDto[];

  @ApiProperty({
    description: 'Response metadata including pagination',
    type: () => PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}

export class UserWrappedRankingDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => UserRankingDataDto })
  data!: UserRankingDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

export class UserWrappedAnalyticsDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => UserAnalyticsDataDto })
  data!: UserAnalyticsDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

export class UserWrappedMyTournamentsDto {
  @ApiProperty({
    description: 'Wrapped response payload (cursor-paginated tournament items)',
    type: () => [MyTournamentItemDataDto],
  })
  data!: MyTournamentItemDataDto[];

  @ApiProperty({
    description: 'Response metadata including pagination',
    type: () => PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}

export class UserWrappedMyTournamentHistoryDto {
  @ApiProperty({
    description: 'Wrapped response payload (cursor-paginated tournament history items)',
    type: () => [MyTournamentHistoryItemDataDto],
  })
  data!: MyTournamentHistoryItemDataDto[];

  @ApiProperty({
    description: 'Response metadata including pagination',
    type: () => PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}

export class UserWrappedMyTournamentAnalyticsDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: () => MyTournamentAnalyticsDataDto,
  })
  data!: MyTournamentAnalyticsDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

export class UserWrappedPublicTournamentProfileDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: () => PublicTournamentProfileDataDto,
  })
  data!: PublicTournamentProfileDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

export class UserWrappedRelatedQuizzesDto {
  @ApiProperty({
    description: 'Wrapped response payload (recommended quiz items)',
    type: () => [QuizListItemDataDto],
  })
  data!: QuizListItemDataDto[];

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

export class UserWrappedUserQuizzesDto {
  @ApiProperty({
    description: 'Wrapped response payload (cursor-paginated quizzes)',
    type: () => [QuizListItemDataDto],
  })
  data!: QuizListItemDataDto[];

  @ApiProperty({
    description: 'Response metadata including pagination',
    type: () => PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}

export class UserWrappedCreatorAnalyticsDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: () => CreatorQuizAnalyticsDataDto,
  })
  data!: CreatorQuizAnalyticsDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}
