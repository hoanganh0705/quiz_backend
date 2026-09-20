import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, OptionalCurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CommentApplicationService } from '../../application/comment-application.service';
import { CommentPresenter } from '../presenters/comment.presenter';
import { ListCommentsQueryDto } from '../../dto/request';
import { COMMENT_THROTTLE } from './throttle.constants';
import {
  ApiListMyCommentsResponses,
  ApiListUserCommentsResponses,
} from '../swagger/comment-swagger-decorators';

@ApiTags('users')
@Controller('users')
export class UserCommentController {
  constructor(
    private readonly application: CommentApplicationService,
    private readonly presenter: CommentPresenter,
  ) {}

  @Get('me/comments')
  @Throttle({
    default: {
      limit: COMMENT_THROTTLE.listMyComments.limit,
      ttl: COMMENT_THROTTLE.listMyComments.ttl,
    },
  })
  @ApiListMyCommentsResponses()
  async listMyComments(@CurrentUser() user: JwtPayload, @Query() query: ListCommentsQueryDto) {
    const result = await this.application.listMyComments(user, query);
    return this.presenter.listMyComments(result);
  }

  @Get(':userId/comments')
  @Public()
  @Throttle({
    default: {
      limit: COMMENT_THROTTLE.listUserComments.limit,
      ttl: COMMENT_THROTTLE.listUserComments.ttl,
    },
  })
  @ApiListUserCommentsResponses()
  async listUserComments(
    @OptionalCurrentUser() viewer: JwtPayload | undefined,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    const result = await this.application.listUserComments(viewer, userId, query);
    return this.presenter.listUserComments(result);
  }
}
