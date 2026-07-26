/**
 * User-Comment Controller
 *
 * User-anchored comment lists:
 *   - `GET /users/me/comments`   — the caller's own comment history
 *   - `GET /users/:userId/comments` — any user's public comment history
 *
 * Both use cursor pagination. The `/me` route requires an
 * authenticated viewer; the `/:userId` route is public.
 */

import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, OptionalCurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CommentApplicationService } from '../../application/comment-application.service';
import { CommentPresenter } from '../presenters/comment.presenter';
import { ListCommentsQueryDto } from '../../dto/request';

@ApiTags('users')
@Controller('users')
export class UserCommentController {
  constructor(
    private readonly application: CommentApplicationService,
    private readonly presenter: CommentPresenter,
  ) {}

  @Get('me/comments')
  @ApiBearerAuth()
  async listMyComments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListCommentsQueryDto,
  ) {
    const result = await this.application.listMyComments(user, query);
    return this.presenter.listMyComments(result);
  }

  @Get(':userId/comments')
  @Public()
  async listUserComments(
    @OptionalCurrentUser() viewer: JwtPayload | undefined,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    const result = await this.application.listUserComments(viewer, userId, query);
    return this.presenter.listUserComments(result);
  }
}
