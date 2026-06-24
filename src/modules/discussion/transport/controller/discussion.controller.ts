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
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import {
  ApiAuth,
  ApiAuthAction,
  ApiAuthActionNoContent,
  ApiPublicList,
  ApiModeratorEndpoint,
  ApiModeratorAction,
} from '@/common/swagger/swagger-decorators';
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
import { TrendingDiscussionCursorMapper } from '@/modules/discussion/mappers/trending-discussion-cursor.mapper';
import { UnansweredDiscussionCursorMapper } from '@/modules/discussion/mappers/unanswered-discussion-cursor.mapper';
import { SearchDiscussionsCursorMapper } from '@/modules/discussion/mappers/search-discussions-cursor.mapper';
import { DiscussionDomainExceptionFilter } from '../filters/discussion-domain-exception.filter';

@ApiTags('discussions')
@Controller('discussions')
@UseFilters(DiscussionDomainExceptionFilter)
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionApplicationService) {}

  // ─── THREADS ──────────────────────────────────────────────────────────────

  @Get('trending')
  @Public()
  @ApiPublicList({
    description: 'Trending discussions returned',
    type: TrendingDiscussionsResponseDto,
  })
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
  @ApiPublicList({
    description: 'Unanswered discussions returned',
    type: UnansweredDiscussionsResponseDto,
  })
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
  @ApiPublicList({ description: 'Search results returned', type: SearchDiscussionsResponseDto })
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
  @ApiPublicList({
    description: 'Related discussions returned',
    type: RelatedDiscussionsResponseDto,
  })
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
  @ApiPublicList({
    description: 'Thread participants returned',
    type: ThreadParticipantsResponseDto,
  })
  async listThreadParticipants(
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<ThreadParticipantsResponseDto> {
    return this.discussionService.listThreadParticipants(threadId);
  }

  @Get('threads/:threadId/stats')
  @Public()
  @ApiPublicList({ description: 'Thread statistics returned', type: ThreadStatsResponseDto })
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
  async getMyDiscussionStats(
    @CurrentUser() user: JwtPayload,
  ): Promise<MyDiscussionStatsResponseDto> {
    return this.discussionService.getMyDiscussionStats(user);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/subscribe')
  @ApiAuthAction({
    description: 'Subscription recorded successfully',
    type: DiscussionSubscriptionActionResponseDto,
  })
  async subscribeToThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionSubscriptionActionResponseDto> {
    return this.discussionService.subscribeToThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId/subscribe')
  @ApiAuthAction({
    description: 'Subscription removed successfully',
    type: DiscussionSubscriptionActionResponseDto,
  })
  async unsubscribeFromThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionSubscriptionActionResponseDto> {
    return this.discussionService.unsubscribeFromThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/save')
  @ApiAuthAction({
    description: 'Thread saved successfully',
    type: DiscussionSavedThreadActionResponseDto,
  })
  async saveThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<DiscussionSavedThreadActionResponseDto> {
    return this.discussionService.saveThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('threads/:threadId/save')
  @ApiAuthAction({
    description: 'Saved thread removed successfully',
    type: DiscussionSavedThreadActionResponseDto,
  })
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
  @ApiCreatedResponse({ description: 'Thread created successfully', type: ThreadDto })
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
  async getThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<ThreadDetailDto | null> {
    return this.discussionService.getThread(user, threadId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put('threads/:threadId')
  @ApiAuthAction({ description: 'Thread updated', type: ThreadDto })
  async updateThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
    @Body() dto: UpdateThreadDto,
  ): Promise<ThreadDto> {
    return this.discussionService.updateThread(user, threadId, dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/close')
  @ApiAuthActionNoContent('Thread closed')
  @HttpCode(HttpStatus.NO_CONTENT)
  async closeThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.closeThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/reopen')
  @ApiAuthActionNoContent('Thread reopened')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reopenThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.reopenThread(user, threadId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('threads/:threadId/solve')
  @ApiAuthAction({
    description: 'Thread marked as solved successfully',
    type: DiscussionThreadSolveResponseDto,
  })
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
  @ApiAuthAction({
    description: 'Thread unsolved successfully',
    type: DiscussionThreadUnsolveResponseDto,
  })
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
  @ApiAuthActionNoContent('Thread deleted')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.deleteThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/hide')
  @Permissions(Permission.DISCUSSION_MODERATE)
  @ApiModeratorAction('Thread hidden')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hideThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<void> {
    await this.discussionService.hideThread(user, threadId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:threadId/restore')
  @Permissions(Permission.DISCUSSION_MODERATE)
  @ApiModeratorAction('Thread restored')
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
  @ApiAuthAction({ description: 'Comment created', type: CommentDto })
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
  async getComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<CommentDto | null> {
    return this.discussionService.getComment(user, commentId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put('comments/:commentId')
  @ApiAuthAction({ description: 'Comment updated', type: CommentDto })
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
  @ApiAuthActionNoContent('Comment deleted')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<void> {
    await this.discussionService.deleteComment(user, commentId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('comments/:commentId/hide')
  @Permissions(Permission.DISCUSSION_MODERATE)
  @ApiModeratorAction('Comment hidden')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hideComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<void> {
    await this.discussionService.hideComment(user, commentId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('comments/:commentId/restore')
  @Permissions(Permission.DISCUSSION_MODERATE)
  @ApiModeratorAction('Comment restored')
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
  @ApiAuthActionNoContent('Vote recorded')
  @HttpCode(HttpStatus.NO_CONTENT)
  async vote(@CurrentUser() user: JwtPayload, @Body() dto: VoteDto): Promise<void> {
    await this.discussionService.vote(user, dto.targetType, dto.targetId, dto.value);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete('vote')
  @ApiAuth()
  @ApiOperation({ summary: 'Remove a vote from a thread, comment, or reply' })
  async removeVote(@CurrentUser() user: JwtPayload, @Body() dto: RemoveVoteDto): Promise<void> {
    await this.discussionService.removeVote(user, dto.targetType, dto.targetId);
  }

  // ─── REPORTS ─────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('report')
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
  @Permissions(Permission.DISCUSSION_MODERATE)
  @ApiModeratorAction('Report reviewed')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reviewReport(
    @CurrentUser() user: JwtPayload,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<void> {
    await this.discussionService.reviewReport(user, reportId, dto.status, dto.actionTaken ?? false);
  }

  @Get('reports')
  @Permissions(Permission.DISCUSSION_MODERATE)
  @ApiModeratorEndpoint({ description: 'Reports returned', type: PaginatedReportsDto })
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
