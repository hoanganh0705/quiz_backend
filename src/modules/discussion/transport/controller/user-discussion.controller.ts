import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiParam } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import {
  ListMyCommentsQueryDto,
  ListMyDiscussionsQueryDto,
  ListMyUpvotedThreadsQueryDto,
  ListMyUpvotedCommentsQueryDto,
  ListMyDiscussionSubscriptionsQueryDto,
  ListMySavedThreadsQueryDto,
} from '@/modules/discussion/dto/request';
import {
  MyCommentsResponseDto,
  MyDiscussionsResponseDto,
  MyUpvotedThreadsResponseDto,
  MyUpvotedCommentsResponseDto,
  MyDiscussionSubscriptionsResponseDto,
  MySavedThreadsResponseDto,
  PublicDiscussionProfileResponseDto,
} from '@/modules/discussion/dto/response';
import { DiscussionPresenter } from '../presenters/discussion.presenter';
import { MyCommentCursorMapper } from '@/modules/discussion/mappers/my-comment-cursor.mapper';
import { MyUpvotedThreadCursorMapper } from '@/modules/discussion/mappers/my-upvoted-thread-cursor.mapper';
import { MyUpvotedCommentCursorMapper } from '@/modules/discussion/mappers/my-upvoted-comment-cursor.mapper';
import { MyDiscussionSubscriptionCursorMapper } from '@/modules/discussion/mappers/my-discussion-subscription-cursor.mapper';
import { MySavedThreadCursorMapper } from '@/modules/discussion/mappers/my-saved-thread-cursor.mapper';
import { QuizDiscussionCursorMapper } from '@/modules/discussion/mappers/quiz-discussion-cursor.mapper';

// All error responses are routed through `GlobalExceptionFilter` as
// RFC 7807 `ProblemDetailDto` after Phase 3.1. The per-module filter
// has been removed.

@ApiTags('users')
@Controller()
export class UserDiscussionController {
  constructor(
    private readonly discussionApplicationService: DiscussionApplicationService,
    private readonly presenter: DiscussionPresenter,
  ) {}

  // ─── Authenticated /users/me/* routes (registered before :userId routes to avoid shadowing) ──

  @Get('users/me/discussions')
  @ApiOkResourceList(MyDiscussionsResponseDto, 'cursor', {
    description: 'My discussions returned',
  })
  async listMyDiscussions(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyDiscussionsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listMyDiscussions(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listMyDiscussions(result);
  }

  @Get('users/me/comments')
  @ApiOkResourceList(MyCommentsResponseDto, 'cursor', { description: 'My comments returned' })
  async listMyComments(@CurrentUser() user: JwtPayload, @Query() query: ListMyCommentsQueryDto) {
    const result = await this.discussionApplicationService.listMyComments(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? MyCommentCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listMyComments(result);
  }

  @Get('users/me/upvoted-threads')
  @ApiOkResourceList(MyUpvotedThreadsResponseDto, 'cursor', {
    description: 'Upvoted threads returned',
  })
  async listMyUpvotedThreads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyUpvotedThreadsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listMyUpvotedThreads(user, {
      limit: query.limit,
      cursor: query.cursor ? MyUpvotedThreadCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listMyUpvotedThreads(result);
  }

  @Get('users/me/upvoted-comments')
  @ApiOkResourceList(MyUpvotedCommentsResponseDto, 'cursor', {
    description: 'Upvoted comments returned',
  })
  async listMyUpvotedComments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyUpvotedCommentsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listMyUpvotedComments(user, {
      limit: query.limit,
      cursor: query.cursor ? MyUpvotedCommentCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listMyUpvotedComments(result);
  }

  @Get('users/me/discussion-subscriptions')
  @ApiOkResourceList(MyDiscussionSubscriptionsResponseDto, 'cursor', {
    description: 'Discussion subscriptions returned',
  })
  async listMyDiscussionSubscriptions(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyDiscussionSubscriptionsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listMyDiscussionSubscriptions(user, {
      limit: query.limit,
      cursor: query.cursor ? MyDiscussionSubscriptionCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listMyDiscussionSubscriptions(result);
  }

  @Get('users/me/saved-threads')
  @ApiOkResourceList(MySavedThreadsResponseDto, 'cursor', {
    description: 'Saved threads returned',
  })
  async listMySavedThreads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMySavedThreadsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listMySavedThreads(user, {
      limit: query.limit,
      cursor: query.cursor ? MySavedThreadCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listMySavedThreads(result);
  }

  // ─── Public /users/:userId/* routes (registered after me/* routes) ──

  @Get('users/:userId/discussions')
  @Public()
  @ApiOkResourceList(MyDiscussionsResponseDto, 'cursor', {
    description: 'User discussions returned',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  async listDiscussionsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyDiscussionsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listMyDiscussions(userId, {
      limit: query.limit,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listDiscussionsByUser(result);
  }

  @Get('users/:userId/comments')
  @Public()
  @ApiOkResourceList(MyCommentsResponseDto, 'cursor', {
    description: 'User comments returned',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  async listCommentsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyCommentsQueryDto,
  ) {
    const result = await this.discussionApplicationService.listCommentsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? MyCommentCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.listCommentsByUser(result);
  }

  @Get('users/:userId/discussion-profile')
  @Public()
  @ApiOkResource(PublicDiscussionProfileResponseDto, {
    description: 'Public discussion profile returned',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  async getPublicDiscussionProfile(@Param('userId', new ParseUUIDPipe()) userId: string) {
    const result = await this.discussionApplicationService.getPublicDiscussionProfile(userId);
    return this.presenter.getPublicDiscussionProfile(result);
  }
}
