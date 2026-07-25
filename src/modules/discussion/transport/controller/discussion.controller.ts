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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags, ApiParam, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import {
  ApiAuthAction,
  ApiAuthActionNoContent,
  ApiModeratorAction,
  ApiNotFound,
} from '@/common/swagger/swagger-decorators';
import { ApiOkResource, ApiOkResourceList, ApiOkResourceArray, ApiCreatedResource } from '@/common/swagger/api-ok';
import { CurrentUser, OptionalCurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import { DiscussionPresenter } from '../presenters/discussion.presenter';
import { ThreadNotFoundError } from '@/modules/discussion/domain/errors';
import {
  ThreadDto,
  CommentDto,
  ThreadDetailDto,
  ReportResponseDto,
  TrendingDiscussionItemResponseDto,
  UnansweredDiscussionItemResponseDto,
  SearchDiscussionItemResponseDto,
  RelatedDiscussionItemResponseDto,
  ThreadParticipantItemResponseDto,
  ThreadStatsResponseDto,
  DiscussionThreadSolveResponseDto,
  DiscussionThreadUnsolveResponseDto,
  DiscussionSubscriptionActionResponseDto,
  DiscussionSavedThreadActionResponseDto,
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
  ListTrendingDiscussionsQueryDto,
  ListUnansweredDiscussionsQueryDto,
  SearchDiscussionsQueryDto,
  ListRelatedDiscussionsQueryDto,
  SolveThreadDto,
  ListThreadsQueryDto,
  ListCommentsQueryDto,
  ListReportsQueryDto,
} from '@/modules/discussion/dto/request';
import { TrendingDiscussionCursorMapper } from '@/modules/discussion/mappers/trending-discussion-cursor.mapper';
import { UnansweredDiscussionCursorMapper } from '@/modules/discussion/mappers/unanswered-discussion-cursor.mapper';
import { SearchDiscussionsCursorMapper } from '@/modules/discussion/mappers/search-discussions-cursor.mapper';

// All 400/403/404/409 error responses are routed through
// `GlobalExceptionFilter` as RFC 7807 `ProblemDetailDto` after Phase 3.1.
// The per-module `DiscussionDomainExceptionFilter` and its
// `@UseFilters(...)` decorator have been removed.

@ApiTags('discussions')
@Controller('discussions')
export class DiscussionController {
  constructor(
    private readonly discussionService: DiscussionApplicationService,
    private readonly presenter: DiscussionPresenter,
  ) {}

  // ─── THREADS ──────────────────────────────────────────────────────────────

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'List trending discussion threads' })
  @ApiOkResourceList(TrendingDiscussionItemResponseDto, 'cursor', {
    description: 'Returns a list of trending discussion threads, sorted by a relevance score.',
  })
  async listTrendingDiscussions(@Query() query: ListTrendingDiscussionsQueryDto) {
    const result = await this.discussionService.listTrendingDiscussions({
      limit: query.limit,
      cursor: query.cursor ? TrendingDiscussionCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listTrendingDiscussions(result);
  }

  @Get('unanswered')
  @Public()
  @ApiOperation({ summary: 'List discussion threads with no comments' })
  @ApiOkResourceList(UnansweredDiscussionItemResponseDto, 'cursor', {
    description: 'Returns discussion threads that have no comments yet.',
  })
  async listUnansweredDiscussions(@Query() query: ListUnansweredDiscussionsQueryDto) {
    const result = await this.discussionService.listUnansweredDiscussions({
      limit: query.limit,
      cursor: query.cursor ? UnansweredDiscussionCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listUnansweredDiscussions(result);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search discussion threads' })
  @ApiOkResourceList(SearchDiscussionItemResponseDto, 'cursor', {
    description:
      'Search returns a paginated list of discussion threads matching the query. Empty searches return { "data": [], "meta": {...} }.',
  })
  async searchDiscussions(@Query() query: SearchDiscussionsQueryDto) {
    const result = await this.discussionService.searchDiscussions({
      q: query.q,
      limit: query.limit,
      cursor: query.cursor ? SearchDiscussionsCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.searchDiscussions(result);
  }

  @Get('threads/:threadId/related')
  @Public()
  @ApiOperation({ summary: 'List threads related to a thread' })
  // Phase 7 (api-contract audit): the runtime emits a non-paginated
  // bare array (bounded by `limit`), so the OpenAPI schema must match —
  // `ApiOkResourceArray` is the canonical decorator for non-paginated
  // bare arrays. The endpoint does not implement cursor pagination.
  @ApiOkResourceArray(RelatedDiscussionItemResponseDto, {
    description: 'Related discussions returned',
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async listRelatedDiscussions(
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
    @Query() query: ListRelatedDiscussionsQueryDto,
  ) {
    const items = await this.discussionService.listRelatedDiscussions(threadId, {
      limit: query.limit,
    });
    return this.presenter.listRelatedDiscussions(items);
  }

  @Get('threads/:threadId/participants')
  @Public()
  @ApiOperation({ summary: 'List participants of a thread' })
  // Phase 7 (api-contract audit): the runtime emits a non-paginated
  // bare array (bounded by the participant count of the thread), so
  // the OpenAPI schema must match — `ApiOkResourceArray` is the
  // canonical decorator for non-paginated bare arrays. The endpoint
  // does not implement cursor pagination.
  @ApiOkResourceArray(ThreadParticipantItemResponseDto, {
    description: 'Thread participants returned',
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async listThreadParticipants(
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ) {
    const items = await this.discussionService.listThreadParticipants(threadId);
    return this.presenter.listThreadParticipants(items);
  }

  @Get('threads/:threadId/stats')
  @Public()
  @ApiOperation({ summary: 'Get statistics for a thread' })
  @ApiOkResource(ThreadStatsResponseDto, {
    description: 'Thread statistics returned',
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async getThreadStats(@Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string) {
    const result = await this.discussionService.getThreadStats(threadId);
    return this.presenter.getThreadStats(result);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/subscribe')
  @ApiOperation({ summary: 'Subscribe to a thread' })
  @ApiAuthAction({
    description: 'Subscription recorded successfully',
    type: DiscussionSubscriptionActionResponseDto,
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async subscribeToThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ) {
    const result = await this.discussionService.subscribeToThread(user, threadId);
    return this.presenter.subscribeToThread(result);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId/subscribe')
  @ApiOperation({ summary: 'Unsubscribe from a thread' })
  @ApiAuthAction({
    description: 'Subscription removed successfully',
    type: DiscussionSubscriptionActionResponseDto,
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async unsubscribeFromThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ) {
    const result = await this.discussionService.unsubscribeFromThread(user, threadId);
    return this.presenter.unsubscribeFromThread(result);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/save')
  @ApiOperation({ summary: 'Save a thread' })
  @ApiAuthAction({
    description: 'Thread saved successfully',
    type: DiscussionSavedThreadActionResponseDto,
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async saveThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ) {
    const result = await this.discussionService.saveThread(user, threadId);
    return this.presenter.saveThread(result);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId/save')
  @ApiOperation({ summary: 'Unsave a thread' })
  @ApiAuthAction({
    description: 'Saved thread removed successfully',
    type: DiscussionSavedThreadActionResponseDto,
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async unsaveThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ) {
    const result = await this.discussionService.unsaveThread(user, threadId);
    return this.presenter.unsaveThread(result);
  }

  @Get('threads')
  @ApiOperation({ summary: 'List threads' })
  @ApiOkResourceList(ThreadDto, 'cursor', { description: 'Threads returned' })
  async listThreads(@CurrentUser() user: JwtPayload, @Query() query: ListThreadsQueryDto) {
    const result = await this.discussionService.listThreads({
      quizId: query.quizId,
      authorId: query.authorId,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
    return this.presenter.listThreads(result);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('threads')
  @ApiOperation({ summary: 'Create a discussion thread' })
  @ApiCreatedResource(ThreadDto, { description: 'Thread created successfully' })
  async createThread(@CurrentUser() user: JwtPayload, @Body() dto: CreateThreadDto) {
    return this.presenter.createThread(
      await this.discussionService.createThread(user, dto.quizId, dto.title, dto.body),
    );
  }

  // Phase 4: Made public - no longer requires authentication
  @Get('threads/:threadId')
  @Public()
  @ApiOperation({
    summary: 'Get a discussion thread by ID',
    description:
      'Returns a single discussion thread by its ID. Public endpoint - accessible without authentication.',
  })
  @ApiOkResource(ThreadDetailDto, { description: 'Thread returned' })
  @ApiNotFound()
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async getThread(
    @OptionalCurrentUser() user: JwtPayload | undefined,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ) {
    const result = await this.discussionService.getThread(user, threadId);
    if (!result) {
      throw new ThreadNotFoundError(threadId);
    }
    return this.presenter.getThread(result);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put('threads/:threadId')
  @ApiOperation({ summary: 'Update a discussion thread' })
  @ApiAuthAction({ description: 'Thread updated', type: ThreadDto })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async updateThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
    @Body() dto: UpdateThreadDto,
  ) {
    if (dto.title === undefined && dto.body === undefined) {
      throw new BadRequestException('At least one field must be provided to update a thread');
    }
    return this.presenter.updateThread(
      await this.discussionService.updateThread(user, threadId, dto),
    );
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/close')
  @ApiOperation({ summary: 'Close a discussion thread' })
  @ApiAuthActionNoContent('Thread closed')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async closeThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ): Promise<void> {
    await this.discussionService.closeThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/reopen')
  @ApiOperation({ summary: 'Reopen a closed discussion thread' })
  @ApiAuthActionNoContent('Thread reopened')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async reopenThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ): Promise<void> {
    await this.discussionService.reopenThread(user, threadId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('threads/:threadId/solve')
  @ApiOperation({ summary: 'Mark a thread as solved' })
  @ApiAuthAction({
    description: 'Thread marked as solved successfully',
    type: DiscussionThreadSolveResponseDto,
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async markThreadAsSolved(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
    @Body() dto: SolveThreadDto,
  ) {
    const thread = await this.discussionService.markThreadAsSolved(user, threadId, dto.commentId);
    return this.presenter.markThreadAsSolved({
      threadId: thread.threadId,
      isSolved: thread.isSolved,
      solvedCommentId: thread.solvedCommentId,
      solvedAt: thread.solvedAt,
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete('threads/:threadId/solve')
  @ApiOperation({ summary: 'Remove the solved status from a thread' })
  @ApiAuthAction({
    description: 'Thread unsolved successfully',
    type: DiscussionThreadUnsolveResponseDto,
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async unsolveThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ) {
    const thread = await this.discussionService.unsolveThread(user, threadId);
    return this.presenter.unsolveThread({
      threadId: thread.threadId,
      isSolved: thread.isSolved,
    });
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId')
  @ApiOperation({ summary: 'Delete a discussion thread' })
  @ApiAuthActionNoContent('Thread deleted')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async deleteThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ): Promise<void> {
    await this.discussionService.deleteThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/hide')
  @ApiOperation({ summary: 'Hide a discussion thread (moderator)' })
  @ApiModeratorAction('Thread hidden')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async hideThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ): Promise<void> {
    await this.discussionService.hideThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/restore')
  @ApiOperation({ summary: 'Restore a hidden discussion thread (moderator)' })
  @ApiModeratorAction('Thread restored')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async restoreThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
  ): Promise<void> {
    await this.discussionService.restoreThread(user, threadId);
  }

  // ─── COMMENTS ─────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('threads/:threadId/comments')
  @ApiOperation({ summary: 'Post a comment on a thread' })
  @ApiCreatedResource(CommentDto, { description: 'Comment created' })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async createComment(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.presenter.createComment(
      await this.discussionService.createComment(
        user,
        threadId,
        dto.body,
        dto.parentCommentId ?? null,
      ),
    );
  }

  // Phase 4: Made public - no longer requires authentication
  @Get('threads/:threadId/comments')
  @Public()
  @ApiOperation({
    summary: 'List comments on a thread',
    description:
      'Returns a paginated list of comments for a given thread. Public endpoint - accessible without authentication.',
  })
  @ApiOkResourceList(CommentDto, 'cursor', { description: 'Comments returned' })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  async listComments(
    @OptionalCurrentUser() user: JwtPayload | undefined,
    @Param('threadId', new ParseUUIDPipe({ version: '7' })) threadId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    const result = await this.discussionService.listComments(user, threadId, {
      parentCommentId: query.parentCommentId ?? null,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
    return this.presenter.listComments(result);
  }

  @Get('comments/:commentId')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiOkResource(CommentDto, { description: 'Comment returned' })
  @ApiParam({ name: 'commentId', format: 'uuid' })
  async getComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ) {
    const result = await this.discussionService.getComment(user, commentId);
    return this.presenter.getComment(result);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put('comments/:commentId')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiAuthAction({ description: 'Comment updated', type: CommentDto })
  @ApiParam({ name: 'commentId', format: 'uuid' })
  async updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    if (dto.body === undefined) {
      throw new BadRequestException('At least one field must be provided to update a comment');
    }
    return this.presenter.updateComment(
      await this.discussionService.updateComment(user, commentId, dto.body),
    );
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiAuthActionNoContent('Comment deleted')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'commentId', format: 'uuid' })
  async deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ): Promise<void> {
    await this.discussionService.deleteComment(user, commentId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('comments/:commentId/hide')
  @ApiOperation({ summary: 'Hide a comment (moderator)' })
  @ApiModeratorAction('Comment hidden')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'commentId', format: 'uuid' })
  async hideComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ): Promise<void> {
    await this.discussionService.hideComment(user, commentId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('comments/:commentId/restore')
  @ApiOperation({ summary: 'Restore a hidden comment (moderator)' })
  @ApiModeratorAction('Comment restored')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'commentId', format: 'uuid' })
  async restoreComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ): Promise<void> {
    await this.discussionService.restoreComment(user, commentId);
  }

  // ─── VOTES ───────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('vote')
  @ApiOperation({ summary: 'Upvote or downvote a thread or comment' })
  @ApiAuthActionNoContent('Vote recorded')
  @HttpCode(HttpStatus.NO_CONTENT)
  async vote(@CurrentUser() user: JwtPayload, @Body() dto: VoteDto): Promise<void> {
    await this.discussionService.vote(user, dto.targetType, dto.targetId, dto.value);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete('vote')
  @ApiOperation({ summary: 'Remove a vote from a thread or comment' })
  @ApiAuthActionNoContent('Vote removed')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVote(@CurrentUser() user: JwtPayload, @Body() dto: RemoveVoteDto): Promise<void> {
    await this.discussionService.removeVote(user, dto.targetType, dto.targetId);
  }

  // ─── REPORTS ─────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('report')
  @ApiOperation({ summary: 'Report a thread or comment' })
  @ApiAuthActionNoContent('Report submitted')
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@CurrentUser() user: JwtPayload, @Body() dto: CreateReportDto): Promise<void> {
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
  @ApiOperation({ summary: 'Review a report (moderator)' })
  @ApiModeratorAction('Report reviewed')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'reportId', format: 'uuid' })
  async reviewReport(
    @CurrentUser() user: JwtPayload,
    @Param('reportId', new ParseUUIDPipe({ version: '7' })) reportId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<void> {
    await this.discussionService.reviewReport(user, reportId, dto.status, dto.actionTaken ?? false);
  }

  @Get('reports')
  @Permissions(Permission.DISCUSSION_MODERATE)
  @ApiOperation({ summary: 'List discussion reports (moderator)' })
  @ApiBearerAuth()
  @ApiOkResourceList(ReportResponseDto, 'cursor', { description: 'Reports returned' })
  async listReports(@CurrentUser() user: JwtPayload, @Query() query: ListReportsQueryDto) {
    const result = await this.discussionService.listReports(user, {
      status: query.status,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
    return this.presenter.listReports(result);
  }
}
