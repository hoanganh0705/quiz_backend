import { Controller, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ApiAuthList, ApiPublicList } from '@/common/swagger/swagger-decorators';
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
import {
  WrappedUserDiscussionsDto,
  WrappedUserCommentsDto,
  WrappedPublicDiscussionProfileDto,
  WrappedMyCommentsDto,
  WrappedMyUpvotedThreadsDto,
  WrappedMyUpvotedCommentsDto,
  WrappedMyDiscussionSubscriptionsDto,
  WrappedMySavedThreadsDto,
  WrappedMyDiscussionsDto,
} from '@/modules/discussion/dto/response/discussion-response-docs.dto';
import { MyCommentCursorMapper } from '@/modules/discussion/mappers/my-comment-cursor.mapper';
import { MyUpvotedThreadCursorMapper } from '@/modules/discussion/mappers/my-upvoted-thread-cursor.mapper';
import { MyUpvotedCommentCursorMapper } from '@/modules/discussion/mappers/my-upvoted-comment-cursor.mapper';
import { MyDiscussionSubscriptionCursorMapper } from '@/modules/discussion/mappers/my-discussion-subscription-cursor.mapper';
import { MySavedThreadCursorMapper } from '@/modules/discussion/mappers/my-saved-thread-cursor.mapper';
import { QuizDiscussionCursorMapper } from '@/modules/discussion/mappers/quiz-discussion-cursor.mapper';
import { DiscussionDomainExceptionFilter } from '../filters/discussion-domain-exception.filter';

@ApiTags('users')
@Controller()
@UseFilters(DiscussionDomainExceptionFilter)
export class UserDiscussionController {
  constructor(private readonly discussionApplicationService: DiscussionApplicationService) {}

  @Get('users/:userId/discussions')
  @Public()
  @ApiPublicList({ description: 'User discussions returned', type: WrappedUserDiscussionsDto })
  listDiscussionsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyDiscussionsQueryDto,
  ): Promise<MyDiscussionsResponseDto> {
    return this.discussionApplicationService.listMyDiscussions(userId, {
      limit: query.limit,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/:userId/comments')
  @Public()
  @ApiPublicList({ description: 'User comments returned', type: WrappedUserCommentsDto })
  listCommentsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyCommentsQueryDto,
  ): Promise<MyCommentsResponseDto> {
    return this.discussionApplicationService.listCommentsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? MyCommentCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/:userId/discussion-profile')
  @Public()
  @ApiPublicList({
    description: 'Public discussion profile returned',
    type: WrappedPublicDiscussionProfileDto,
  })
  getPublicDiscussionProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<PublicDiscussionProfileResponseDto> {
    return this.discussionApplicationService.getPublicDiscussionProfile(userId);
  }

  @Get('users/me/comments')
  @ApiAuthList({ description: 'My comments returned', type: WrappedMyCommentsDto })
  listMyComments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyCommentsQueryDto,
  ): Promise<MyCommentsResponseDto> {
    return this.discussionApplicationService.listMyComments(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? MyCommentCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/me/upvoted-threads')
  @ApiAuthList({ description: 'Upvoted threads returned', type: WrappedMyUpvotedThreadsDto })
  listMyUpvotedThreads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyUpvotedThreadsQueryDto,
  ): Promise<MyUpvotedThreadsResponseDto> {
    return this.discussionApplicationService.listMyUpvotedThreads(user, {
      limit: query.limit,
      cursor: query.cursor ? MyUpvotedThreadCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/me/upvoted-comments')
  @ApiAuthList({ description: 'Upvoted comments returned', type: WrappedMyUpvotedCommentsDto })
  listMyUpvotedComments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyUpvotedCommentsQueryDto,
  ): Promise<MyUpvotedCommentsResponseDto> {
    return this.discussionApplicationService.listMyUpvotedComments(user, {
      limit: query.limit,
      cursor: query.cursor ? MyUpvotedCommentCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/me/discussion-subscriptions')
  @ApiAuthList({
    description: 'Discussion subscriptions returned',
    type: WrappedMyDiscussionSubscriptionsDto,
  })
  listMyDiscussionSubscriptions(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyDiscussionSubscriptionsQueryDto,
  ): Promise<MyDiscussionSubscriptionsResponseDto> {
    return this.discussionApplicationService.listMyDiscussionSubscriptions(user, {
      limit: query.limit,
      cursor: query.cursor ? MyDiscussionSubscriptionCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/me/saved-threads')
  @ApiAuthList({ description: 'Saved threads returned', type: WrappedMySavedThreadsDto })
  listMySavedThreads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMySavedThreadsQueryDto,
  ): Promise<MySavedThreadsResponseDto> {
    return this.discussionApplicationService.listMySavedThreads(user, {
      limit: query.limit,
      cursor: query.cursor ? MySavedThreadCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('users/me/discussions')
  @ApiAuthList({ description: 'My discussions returned', type: WrappedMyDiscussionsDto })
  listMyDiscussions(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyDiscussionsQueryDto,
  ): Promise<MyDiscussionsResponseDto> {
    return this.discussionApplicationService.listMyDiscussions(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? QuizDiscussionCursorMapper.parse(query.cursor) : null,
    });
  }
}
