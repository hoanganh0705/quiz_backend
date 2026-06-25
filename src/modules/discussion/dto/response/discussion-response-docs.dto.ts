import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrendingDiscussionItemResponseDto } from './trending-discussions-response.dto';
import { UnansweredDiscussionItemResponseDto } from './unanswered-discussions-response.dto';
import { SearchDiscussionItemResponseDto } from './search-discussions-response.dto';
import { RelatedDiscussionItemResponseDto } from './related-discussions-response.dto';
import { ThreadParticipantItemResponseDto } from './thread-participants-response.dto';
import { ThreadStatsResponseDto } from './thread-stats-response.dto';
import { MyDiscussionStatsResponseDto } from './my-discussion-stats-response.dto';
import { PublicDiscussionProfileResponseDto } from './public-discussion-profile-response.dto';
import { MyDiscussionItemResponseDto } from './my-discussions-response.dto';
import { MyCommentItemResponseDto } from './my-comments-response.dto';
import { MyUpvotedThreadItemResponseDto } from './my-upvoted-threads-response.dto';
import { MyUpvotedCommentItemResponseDto } from './my-upvoted-comments-response.dto';
import { MyDiscussionSubscriptionItemResponseDto } from './my-discussion-subscriptions-response.dto';
import { MySavedThreadItemResponseDto } from './my-saved-threads-response.dto';
import { QuizDiscussionItemResponseDto } from './quiz-discussion-list-response.dto';
import { DiscussionSubscriptionActionResponseDto } from './discussion-subscription-action-response.dto';
import { DiscussionSavedThreadActionResponseDto } from './discussion-saved-thread-action-response.dto';
import {
  DiscussionThreadSolveResponseDto,
  DiscussionThreadUnsolveResponseDto,
} from './discussion-thread-solve-response.dto';
import { PaginatedReportsDto } from './report-response.dto';
import { ThreadDto } from './thread-response.dto';
import { CommentDto, ThreadDetailDto } from './comment-response.dto';
import { PaginatedThreadsDto, PaginatedCommentsDto } from './paginated-response.dto';

// ─── Discussion module documentation-only wrapper DTOs ─────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated responses (when payload has { items, pagination }), it transforms to:
//   { data: <items[]>, meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
//
// These wrapper DTOs document the actual wrapped shape in the OpenAPI spec.
//

// ─── Meta types ────────────────────────────────────────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class PaginationMetaDataDto {
  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
    example: null,
  })
  nextCursor!: string | null;
}

class PaginatedMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Cursor-based pagination metadata', type: PaginationMetaDataDto })
  pagination!: PaginationMetaDataDto;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

export class WrappedTrendingDiscussionsDto {
  @ApiProperty({
    description: 'Trending discussion items',
    type: () => [TrendingDiscussionItemResponseDto],
  })
  data!: TrendingDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedUnansweredDiscussionsDto {
  @ApiProperty({
    description: 'Unanswered discussion items',
    type: () => [UnansweredDiscussionItemResponseDto],
  })
  data!: UnansweredDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedSearchDiscussionsDto {
  @ApiProperty({
    description: 'Search result items',
    type: () => [SearchDiscussionItemResponseDto],
  })
  data!: SearchDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedRelatedDiscussionsDto {
  @ApiProperty({
    description: 'Related discussion items',
    type: () => [RelatedDiscussionItemResponseDto],
  })
  data!: RelatedDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedThreadParticipantsDto {
  @ApiProperty({
    description: 'Thread participant items',
    type: () => [ThreadParticipantItemResponseDto],
  })
  data!: ThreadParticipantItemResponseDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedThreadStatsDto {
  @ApiPropertyOptional({
    description: 'Thread statistics. `null` if the thread does not exist.',
    type: () => ThreadStatsResponseDto,
    nullable: true,
  })
  data!: ThreadStatsResponseDto | null;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedMyDiscussionStatsDto {
  @ApiProperty({
    description: 'Authenticated user discussion statistics',
    type: () => MyDiscussionStatsResponseDto,
  })
  data!: MyDiscussionStatsResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedQuizDiscussionsDto {
  @ApiProperty({
    description: 'Quiz discussion items',
    type: () => [QuizDiscussionItemResponseDto],
  })
  data!: QuizDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMyDiscussionsDto {
  @ApiProperty({
    description: 'Discussion items owned by the authenticated user',
    type: () => [MyDiscussionItemResponseDto],
  })
  data!: MyDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMyCommentsDto {
  @ApiProperty({
    description: 'Comment items by the authenticated user',
    type: () => [MyCommentItemResponseDto],
  })
  data!: MyCommentItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMyUpvotedThreadsDto {
  @ApiProperty({
    description: 'Upvoted thread items',
    type: () => [MyUpvotedThreadItemResponseDto],
  })
  data!: MyUpvotedThreadItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMyUpvotedCommentsDto {
  @ApiProperty({
    description: 'Upvoted comment items',
    type: () => [MyUpvotedCommentItemResponseDto],
  })
  data!: MyUpvotedCommentItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMyDiscussionSubscriptionsDto {
  @ApiProperty({
    description: 'Discussion subscription items',
    type: () => [MyDiscussionSubscriptionItemResponseDto],
  })
  data!: MyDiscussionSubscriptionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMySavedThreadsDto {
  @ApiProperty({
    description: 'Saved thread items',
    type: () => [MySavedThreadItemResponseDto],
  })
  data!: MySavedThreadItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedUserDiscussionsDto {
  @ApiProperty({
    description: 'Discussion items owned by the user',
    type: () => [MyDiscussionItemResponseDto],
  })
  data!: MyDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedUserCommentsDto {
  @ApiProperty({
    description: 'Comment items by the user',
    type: () => [MyCommentItemResponseDto],
  })
  data!: MyCommentItemResponseDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedPublicDiscussionProfileDto {
  @ApiProperty({
    description: 'Public discussion profile',
    type: () => PublicDiscussionProfileResponseDto,
  })
  data!: PublicDiscussionProfileResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedThreadDto {
  @ApiProperty({
    description: 'Created thread',
    type: () => ThreadDto,
  })
  data!: ThreadDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedThreadDetailDto {
  @ApiPropertyOptional({
    description: 'Thread detail with comments. `null` if the thread does not exist.',
    type: () => ThreadDetailDto,
    nullable: true,
  })
  data!: ThreadDetailDto | null;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedCommentDto {
  @ApiPropertyOptional({
    description: 'Comment details. `null` if the comment does not exist.',
    type: () => CommentDto,
    nullable: true,
  })
  data!: CommentDto | null;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedPaginatedThreadsDto {
  @ApiProperty({
    description: 'Paginated thread list',
    type: () => PaginatedThreadsDto,
  })
  data!: PaginatedThreadsDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedPaginatedCommentsDto {
  @ApiProperty({
    description: 'Paginated comment list',
    type: () => PaginatedCommentsDto,
  })
  data!: PaginatedCommentsDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedSubscriptionActionDto {
  @ApiProperty({
    description: 'Subscription action result',
    type: () => DiscussionSubscriptionActionResponseDto,
  })
  data!: DiscussionSubscriptionActionResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedSavedThreadActionDto {
  @ApiProperty({
    description: 'Save thread action result',
    type: () => DiscussionSavedThreadActionResponseDto,
  })
  data!: DiscussionSavedThreadActionResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedThreadSolveDto {
  @ApiProperty({
    description: 'Thread solve result',
    type: () => DiscussionThreadSolveResponseDto,
  })
  data!: DiscussionThreadSolveResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedThreadUnsolveDto {
  @ApiProperty({
    description: 'Thread unsolve result',
    type: () => DiscussionThreadUnsolveResponseDto,
  })
  data!: DiscussionThreadUnsolveResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedPaginatedReportsDto {
  @ApiProperty({
    description: 'Paginated report list',
    type: () => PaginatedReportsDto,
  })
  data!: PaginatedReportsDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}
