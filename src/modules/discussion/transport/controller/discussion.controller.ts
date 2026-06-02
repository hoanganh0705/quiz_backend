import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
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
} from '@nestjs/swagger';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { RequireAuth } from '@/common/guards/jwt.guard';
import { Permissions } from '@/common/authorization/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import {
  ThreadDto,
  ThreadDetailDto,
  CommentDto,
  CommentWithRepliesDto,
  PaginatedThreadsDto,
  PaginatedCommentsDto,
  PaginatedReportsDto,
} from '@/modules/discussion/dto/response';
import {
  CreateThreadDto,
  UpdateThreadDto,
  CreateCommentDto,
  UpdateCommentDto,
  VoteDto,
  RemoveVoteDto,
  ReportDto,
  ReviewReportDto,
  ListThreadsQueryDto,
  ListCommentsQueryDto,
  ListReportsQueryDto,
} from '@/modules/discussion/dto/request';
import { DiscussionDomainExceptionFilter } from './filters/discussion-domain-exception.filter';

@ApiTags('discussions')
@ApiBearerAuth()
@RequireAuth()
@Controller('discussions')
@UseFilters(DiscussionDomainExceptionFilter)
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionApplicationService) {}

  // ─── THREADS ──────────────────────────────────────────────────────────────

  @Post('threads')
  @ApiAuth()
  @ApiOperation({ summary: 'Create a discussion thread' })
  @ApiCreatedResponse({ description: 'Thread created', type: ThreadDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async createThread(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateThreadDto,
  ): Promise<ThreadDto> {
    return this.discussionService.createThread(user, dto.quizId, dto.title, dto.body);
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

  @Post('threads/:threadId/close')
  @ApiAuth()
  @ApiOperation({ summary: 'Close a thread (author only)' })
  @ApiOkResponse({ description: 'Thread closed' })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not the thread author' })
  async closeThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<{ message: string }> {
    await this.discussionService.closeThread(user, threadId);
    return { message: 'Thread closed' };
  }

  @Post('threads/:threadId/reopen')
  @ApiAuth()
  @ApiOperation({ summary: 'Reopen a closed thread (author only)' })
  @ApiOkResponse({ description: 'Thread reopened' })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not the thread author' })
  async reopenThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<{ message: string }> {
    await this.discussionService.reopenThread(user, threadId);
    return { message: 'Thread reopened' };
  }

  @Delete('threads/:threadId')
  @ApiAuth()
  @ApiOperation({ summary: 'Soft-delete a thread (author only)' })
  @ApiOkResponse({ description: 'Thread deleted' })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not the thread author' })
  async deleteThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<{ message: string }> {
    await this.discussionService.deleteThread(user, threadId);
    return { message: 'Thread deleted' };
  }

  @Post('threads/:threadId/hide')
  @ApiAuth()
  @Permissions('admin', 'moderator')
  @ApiOperation({ summary: 'Hide a thread (moderator only)' })
  @ApiOkResponse({ description: 'Thread hidden' })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  async hideThread(
    @CurrentUser() user: JwtPayload,
    @Param('threadId', new ParseUUIDPipe()) threadId: string,
  ): Promise<{ message: string }> {
    await this.discussionService.hideThread(user, threadId);
    return { message: 'Thread hidden' };
  }

  // ─── COMMENTS ─────────────────────────────────────────────────────────────

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
    return this.discussionService.updateComment(user, commentId, dto.body);
  }

  @Delete('comments/:commentId')
  @ApiAuth()
  @ApiOperation({ summary: 'Soft-delete a comment (author only)' })
  @ApiOkResponse({ description: 'Comment deleted' })
  @ApiNotFoundResponse({ description: 'Comment not found' })
  @ApiForbiddenResponse({ description: 'Not the comment author' })
  async deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<{ message: string }> {
    await this.discussionService.deleteComment(user, commentId);
    return { message: 'Comment deleted' };
  }

  @Post('comments/:commentId/hide')
  @ApiAuth()
  @Permissions('admin', 'moderator')
  @ApiOperation({ summary: 'Hide a comment (moderator only)' })
  @ApiOkResponse({ description: 'Comment hidden' })
  @ApiNotFoundResponse({ description: 'Comment not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  async hideComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
  ): Promise<{ message: string }> {
    await this.discussionService.hideComment(user, commentId);
    return { message: 'Comment hidden' };
  }

  // ─── VOTES ───────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('vote')
  @ApiAuth()
  @ApiOperation({ summary: 'Cast or toggle a vote on a thread, comment, or reply' })
  @ApiOkResponse({ description: 'Vote recorded' })
  @ApiNotFoundResponse({ description: 'Target not found' })
  @ApiForbiddenResponse({ description: 'Cannot vote on own content' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async vote(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VoteDto,
  ): Promise<{ message: string }> {
    await this.discussionService.vote(user, dto.targetType, dto.targetId, dto.value);
    return { message: 'Vote recorded' };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete('vote')
  @ApiAuth()
  @ApiOperation({ summary: 'Remove a vote from a thread, comment, or reply' })
  @ApiOkResponse({ description: 'Vote removed' })
  async removeVote(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RemoveVoteDto,
  ): Promise<{ message: string }> {
    await this.discussionService.removeVote(user, dto.targetType, dto.targetId);
    return { message: 'Vote removed' };
  }

  // ─── REPORTS ─────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('report')
  @ApiAuth()
  @ApiOperation({ summary: 'Report a thread, comment, or reply for moderation review' })
  @ApiOkResponse({ description: 'Report submitted' })
  @ApiNotFoundResponse({ description: 'Target not found' })
  @ApiForbiddenResponse({ description: 'Cannot report own content' })
  @ApiConflictResponse({ description: 'You have already reported this content' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async report(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReportDto,
  ): Promise<{ message: string }> {
    await this.discussionService.report(
      user,
      dto.targetType,
      dto.targetId,
      dto.reason,
      dto.details ?? null,
    );
    return { message: 'Report submitted' };
  }

  @Post('reports/:reportId/review')
  @ApiAuth()
  @Permissions('admin', 'moderator')
  @ApiOperation({ summary: 'Review and resolve a report (moderator only)' })
  @ApiOkResponse({ description: 'Report reviewed' })
  @ApiNotFoundResponse({ description: 'Report not found' })
  @ApiForbiddenResponse({ description: 'Not a moderator' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiValidationRequest()
  async reviewReport(
    @CurrentUser() user: JwtPayload,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<{ message: string }> {
    await this.discussionService.reviewReport(user, reportId, dto.status, dto.actionTaken ?? false);
    return { message: 'Report reviewed' };
  }

  @Get('reports')
  @ApiAuth()
  @Permissions('admin', 'moderator')
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
