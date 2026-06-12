import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseFilters,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiAuth, ApiValidationRequest, ApiNoContent } from '@/common/swagger/swagger-decorators';
import { RequireAuth } from '@/common/guards/jwt.guard';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import {
  ThreadDto,
  ThreadDetailDto,
  CommentDto,
  PaginatedThreadsDto,
  PaginatedCommentsDto,
  PaginatedReportsDto,
  TrendingDiscussionsResponseDto,
  UnansweredDiscussionsResponseDto,
  SearchDiscussionsResponseDto,
  RelatedDiscussionsResponseDto,
  ThreadParticipantsResponseDto,
  ThreadStatsResponseDto,
  MyDiscussionStatsResponseDto,
  DiscussionSubscriptionActionResponseDto,
  DiscussionSavedThreadActionResponseDto,
  DiscussionThreadSolveResponseDto,
  DiscussionThreadUnsolveResponseDto,
} from '@/modules/discussion/dto/response';
import {
  UpdateThreadDto,
  CreateCommentDto,
  CreateThreadDto,
  UpdateCommentDto,
  VoteDto,
  RemoveVoteDto,
  CreateReportDto,
  ReviewReportDto,
  ListThreadsQueryDto,
  ListCommentsQueryDto,
  ListReportsQueryDto,
  ListTrendingDiscussionsQueryDto,
  ListUnansweredDiscussionsQueryDto,
  SearchDiscussionsQueryDto,
  ListRelatedDiscussionsQueryDto,
  SolveThreadDto,
} from '@/modules/discussion/dto/request';
import type { DiscussionReportStatus } from '@/modules/discussion/domain/types';
import { DiscussionDomainExceptionFilter } from './filters/discussion-domain-exception.filter';
import { TrendingDiscussionCursorMapper } from '@/modules/discussion/mappers/trending-discussion-cursor.mapper';
import { UnansweredDiscussionCursorMapper } from '@/modules/discussion/mappers/unanswered-discussion-cursor.mapper';
import { SearchDiscussionsCursorMapper } from '@/modules/discussion/mappers/search-discussions-cursor.mapper';

@ApiTags('discussions')
@ApiBearerAuth()
@RequireAuth()
@Controller('discussions')
@UseFilters(DiscussionDomainExceptionFilter)
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionApplicationService) {}

  // ─── THREADS ──────────────────────────────────────────────────────────────

  @Get('trending')
  @Public()
  @ApiOperation({
    summary: 'List trending discussions',
    description:
      'Returns discussion threads ordered by a trending score that factors in votes, comments, and recent reply activity within the last 7 days.',
  })
  @ApiOkResponse({
    description: 'Trending discussions returned',
    type: TrendingDiscussionsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listTrendingDiscussions(
    @Query() query: ListTrendingDiscussionsQueryDto,
  ): Promise<TrendingDiscussionsResponseDto> {
    return this.discussionService.listTrendingDiscussions({
      limit: query.limit,
      cursor: query.cursor ? TrendingDiscussionCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('unanswered')
  @Public()
  @ApiOperation({
    summary: 'List unanswered discussions',
    description:
      'Returns open discussion threads that have not yet received any comments, ordered by newest first.',
  })
  @ApiOkResponse({
    description: 'Unanswered discussions returned',
    type: UnansweredDiscussionsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listUnansweredDiscussions(
    @Query() query: ListUnansweredDiscussionsQueryDto,
  ): Promise<UnansweredDiscussionsResponseDto> {
    return this.discussionService.listUnansweredDiscussions({
      limit: query.limit,
      cursor: query.cursor ? UnansweredDiscussionCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Search discussions',
    description:
      'Searches discussion threads by keyword in title and body, ordered by newest first.',
  })
  @ApiOkResponse({
    description: 'Search results returned',
    type: SearchDiscussionsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async searchDiscussions(
    @Query() query: SearchDiscussionsQueryDto,
  ): Promise<SearchDiscussionsResponseDto> {
    return this.discussionService.searchDiscussions({
      q: query.q,
      limit: query.limit,
      cursor: query.cursor ? SearchDiscussionsCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('threads/:threadId/related')
  @Public()
  @ApiOperation({
    summary: 'List related discussions',
    description:
      'Returns up to 10 discussion threads related to the specified thread based on quiz overlap, shared categories or tags, and similar title keywords.',
  })
  @ApiOkResponse({
    description: 'Related discussions returned',
    type: RelatedDiscussionsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listRelatedDiscussions(
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
    @Query() query: ListRelatedDiscussionsQueryDto,
  ): Promise<RelatedDiscussionsResponseDto> {
    return this.discussionService.listRelatedDiscussions(threadId, {
      limit: query.limit,
    });
  }

  @Get('threads/:threadId/participants')
  @Public()
  @ApiOperation({
    summary: 'List thread participants',
    description:
      'Returns all unique users who participated in the specified thread, including the thread author and commenters, ordered by comment count descending.',
  })
  @ApiOkResponse({
    description: 'Thread participants returned',
    type: ThreadParticipantsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listThreadParticipants(
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<ThreadParticipantsResponseDto> {
    return this.discussionService.listThreadParticipants(threadId);
  }

  @Get('threads/:threadId/stats')
  @Public()
  @ApiOperation({
    summary: 'Get thread statistics',
    description:
      'Returns aggregated statistics for a discussion thread including comments, replies, participants, votes, and latest activity.',
  })
  @ApiOkResponse({
    description: 'Thread statistics returned',
    type: ThreadStatsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getThreadStats(
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<ThreadStatsResponseDto | null> {
    return this.discussionService.getThreadStats(threadId);
  }

  @Get('me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my discussion stats',
    description:
      'Returns aggregated discussion statistics for the authenticated user including threads created, comments, replies, contributions, votes received, and latest activity.',
  })
  @ApiOkResponse({
    description: 'Discussion statistics returned',
    type: MyDiscussionStatsResponseDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getMyDiscussionStats(
    @CurrentUser() user: JwtPayload,
  ): Promise<MyDiscussionStatsResponseDto> {
    return this.discussionService.getMyDiscussionStats(user);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/subscribe')
  @ApiAuth()
  @ApiOperation({
    summary: 'Subscribe to discussion thread',
    description:
      'Subscribes the authenticated user to the specified discussion thread. The operation is idempotent and succeeds even if the user is already subscribed.',
  })
  @ApiOkResponse({
    description: 'Subscription recorded successfully',
    type: DiscussionSubscriptionActionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async subscribeToThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionSubscriptionActionResponseDto> {
    return this.discussionService.subscribeToThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId/subscribe')
  @ApiAuth()
  @ApiOperation({
    summary: 'Unsubscribe from discussion thread',
    description:
      'Unsubscribes the authenticated user from the specified discussion thread. The operation is idempotent and succeeds even if no subscription exists.',
  })
  @ApiOkResponse({
    description: 'Subscription removed successfully',
    type: DiscussionSubscriptionActionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async unsubscribeFromThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionSubscriptionActionResponseDto> {
    return this.discussionService.unsubscribeFromThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/save')
  @ApiAuth()
  @ApiOperation({
    summary: 'Save discussion thread',
    description:
      'Saves the specified discussion thread for the authenticated user. The operation is idempotent and succeeds even if the thread is already saved.',
  })
  @ApiOkResponse({
    description: 'Thread saved successfully',
    type: DiscussionSavedThreadActionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async saveThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionSavedThreadActionResponseDto> {
    return this.discussionService.saveThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId/save')
  @ApiAuth()
  @ApiOperation({
    summary: 'Remove saved discussion thread',
    description:
      'Removes the specified saved discussion thread for the authenticated user. The operation is idempotent and succeeds even if the thread is not currently saved.',
  })
  @ApiOkResponse({
    description: 'Saved thread removed successfully',
    type: DiscussionSavedThreadActionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async unsaveThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionSavedThreadActionResponseDto> {
    return this.discussionService.unsaveThread(user, threadId);
  }

  @Get('threads')
  @ApiAuth()
  @ApiOperation({ summary: 'List discussion threads' })
  @ApiOkResponse({ description: 'Threads returned', type: PaginatedThreadsDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async listThreads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListThreadsQueryDto,
  ): Promise<PaginatedThreadsDto> {
    return this.discussionService.listThreads(user, {
      quizId: query.quizId,
      authorId: query.authorId,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('threads')
  @ApiAuth()
  @ApiOperation({
    summary: 'Create a new discussion thread',
    description:
      'Creates a discussion thread for the specified quiz. The authenticated user becomes the thread author.',
  })
  @ApiCreatedResponse({
    description: 'Thread created successfully',
    type: ThreadDto,
  })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async createThread(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateThreadDto,
  ): Promise<ThreadDto> {
    return this.discussionService.createThread(user, dto.quizId, dto.title, dto.body);
  }

  @Get('threads/:threadId')
  @ApiAuth()
  @ApiOperation({ summary: 'Get a thread with its comments' })
  @ApiOkResponse({ description: 'Thread returned', type: ThreadDetailDto })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  async getThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<ThreadDetailDto | null> {
    return this.discussionService.getThread(user, threadId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put('threads/:threadId')
  @ApiAuth()
  @ApiOperation({ summary: 'Update a thread (author only)' })
  @ApiOkResponse({ description: 'Thread updated', type: ThreadDto })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not the thread author' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async updateThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
    @Body() dto: UpdateThreadDto,
  ): Promise<ThreadDto> {
    return this.discussionService.updateThread(user, threadId, dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/close')
  @ApiAuth()
  @ApiOperation({ summary: 'Close a thread (author only)' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not the thread author' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async closeThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.closeThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/reopen')
  @ApiAuth()
  @ApiOperation({ summary: 'Reopen a closed thread (author only)' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not the thread author' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async reopenThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.reopenThread(user, threadId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('threads/:threadId/solve')
  @ApiAuth()
  @ApiOperation({
    summary: 'Mark thread as solved',
    description:
      'Marks a discussion thread as solved by selecting one of its comments as the accepted solution.',
  })
  @ApiOkResponse({
    description: 'Thread marked as solved successfully',
    type: DiscussionThreadSolveResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread or comment not found' })
  @ApiForbiddenResponse({ description: 'Only the thread owner can solve the thread' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async markThreadAsSolved(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
    @Body() dto: SolveThreadDto,
  ): Promise<DiscussionThreadSolveResponseDto> {
    const thread = await this.discussionService.markThreadAsSolved(user, threadId, dto.commentId);

    return {
      threadId: thread.threadId,
      isSolved: thread.isSolved,
      solvedCommentId: thread.solvedCommentId,
      solvedAt: thread.solvedAt,
    };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete('threads/:threadId/solve')
  @ApiAuth()
  @ApiOperation({
    summary: 'Unsolve thread',
    description:
      'Removes the solved state from a discussion thread owned by the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Thread unsolved successfully',
    type: DiscussionThreadUnsolveResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Only the thread owner can unsolve the thread' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async unsolveThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionThreadUnsolveResponseDto> {
    const thread = await this.discussionService.unsolveThread(user, threadId);

    return {
      threadId: thread.threadId,
      isSolved: thread.isSolved,
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId')
  @ApiAuth()
  @ApiOperation({ summary: 'Soft-delete a thread (author only)' })
  @ApiNoContent('Thread deleted')
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not the thread author' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.deleteThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/hide')
  @ApiAuth()
  @Roles('admin', 'moderator')
  @ApiOperation({ summary: 'Hide a thread (moderator only)' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async hideThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.hideThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/restore')
  @ApiAuth()
  @Roles('admin', 'moderator')
  @ApiOperation({ summary: 'Restore a hidden thread (moderator only)' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.restoreThread(user, threadId);
  }

  // ─── COMMENTS ─────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('threads/:threadId/comments')
  @ApiAuth()
  @ApiOperation({ summary: 'Add a comment or reply to a thread' })
  @ApiCreatedResponse({ description: 'Comment created', type: CommentDto })
  @ApiNotFoundResponse({ description: 'Thread or parent comment not found' })
  @ApiConflictResponse({ description: 'Thread is closed' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async createComment(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.discussionService.createComment(
      user,
      threadId,
      dto.body,
      dto.parentCommentId ?? null,
    );
  }

  @Get('threads/:threadId/comments')
  @ApiAuth()
  @ApiOperation({ summary: 'List comments on a thread' })
  @ApiOkResponse({ description: 'Comments returned', type: PaginatedCommentsDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async listComments(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
    @Query() query: ListCommentsQueryDto,
  ): Promise<PaginatedCommentsDto> {
    return this.discussionService.listComments(user, threadId, {
      parentCommentId: query.parentCommentId ?? null,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
  }

  @Get('comments/:commentId')
  @ApiAuth()
  @ApiOperation({ summary: 'Get a single comment' })
  @ApiOkResponse({ description: 'Comment returned', type: CommentDto })
  @ApiNotFoundResponse({ description: 'Comment not found' })
  async getComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<CommentDto | null> {
    return this.discussionService.getComment(user, commentId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put('comments/:commentId')
  @ApiAuth()
  @ApiOperation({ summary: 'Update a comment (author only)' })
  @ApiOkResponse({ description: 'Comment updated', type: CommentDto })
  @ApiNotFoundResponse({ description: 'Comment not found' })
  @ApiForbiddenResponse({ description: 'Not the comment author' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentDto> {
    if (dto.body === undefined) {
      throw new BadRequestException('At least one field must be provided to update a comment');
    }
    return this.discussionService.updateComment(user, commentId, dto.body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('comments/:commentId')
  @ApiAuth()
  @ApiOperation({ summary: 'Soft-delete a comment (author only)' })
  @ApiNoContent('Comment deleted')
  @ApiNotFoundResponse({ description: 'Comment not found' })
  @ApiForbiddenResponse({ description: 'Not the comment author' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<void> {
    await this.discussionService.deleteComment(user, commentId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('comments/:commentId/hide')
  @ApiAuth()
  @Roles('admin', 'moderator')
  @ApiOperation({ summary: 'Hide a comment (moderator only)' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Comment not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async hideComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<void> {
    await this.discussionService.hideComment(user, commentId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('comments/:commentId/restore')
  @ApiAuth()
  @Roles('admin', 'moderator')
  @ApiOperation({ summary: 'Restore a hidden comment (moderator only)' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Comment not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<void> {
    await this.discussionService.restoreComment(user, commentId);
  }

  // ─── VOTES ───────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('vote')
  @ApiAuth()
  @ApiOperation({ summary: 'Cast or toggle a vote on a thread, comment, or reply' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Target not found' })
  @ApiForbiddenResponse({ description: 'Cannot vote on own content' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  @HttpCode(HttpStatus.NO_CONTENT)
  async vote(@CurrentUser() user: JwtPayload, @Body() dto: VoteDto): Promise<void> {
    await this.discussionService.vote(user, dto.targetType, dto.targetId, dto.value);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete('vote')
  @ApiAuth()
  @ApiOperation({ summary: 'Remove a vote from a thread, comment, or reply' })
  @ApiNoContent()
  async removeVote(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RemoveVoteDto,
  ): Promise<void> {
    await this.discussionService.removeVote(user, dto.targetType, dto.targetId);
  }

  // ─── REPORTS ─────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('report')
  @ApiAuth()
  @ApiOperation({ summary: 'Report a thread, comment, or reply for moderation review' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Target not found' })
  @ApiForbiddenResponse({ description: 'Cannot report own content' })
  @ApiConflictResponse({ description: 'You have already reported this content' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReportDto,
  ): Promise<void> {
    await this.discussionService.report(
      user,
      dto.targetType,
      dto.targetId,
      dto.reason,
      dto.details ?? null,
    );
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('reports/:reportId/review')
  @ApiAuth()
  @Roles('admin', 'moderator')
  @ApiOperation({ summary: 'Review and resolve a report (moderator only)' })
  @ApiNoContent()
  @ApiNotFoundResponse({ description: 'Report not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reviewReport(
    @CurrentUser() user: JwtPayload,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<void> {
    await this.discussionService.reviewReport(user, reportId, dto.status, dto.actionTaken ?? false);
  }

  @Get('reports')
  @ApiAuth()
  @Roles('admin', 'moderator')
  @ApiOperation({ summary: 'List reports for moderation review (moderator only)' })
  @ApiOkResponse({ description: 'Reports returned', type: PaginatedReportsDto })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async listReports(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListReportsQueryDto,
  ): Promise<PaginatedReportsDto> {
    return this.discussionService.listReports(user, {
      status: query.status,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
  }
}
