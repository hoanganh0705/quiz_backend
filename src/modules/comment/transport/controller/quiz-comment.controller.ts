/**
 * Quiz-Comment Controller
 *
 * Routes anchored to a quiz:
 *   - `GET  /quizzes/:quizId/comments` — public list of top-level
 *     comments for a quiz, with the first page of replies inlined
 *     and the requester's `userVote` projected.
 *   - `POST /quizzes/:quizId/comments` — create a top-level comment
 *     or a reply. The parent, if present, must be a top-level
 *     comment on the same quiz.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, OptionalCurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CommentApplicationService } from '../../application/comment-application.service';
import { CommentPresenter } from '../presenters/comment.presenter';
import { CreateCommentDto, ListCommentsQueryDto } from '../../dto/request';
import {
  ApiCreateCommentResponses,
  ApiListQuizCommentsResponses,
} from '../swagger/comment-swagger-decorators';

@ApiTags('quizzes')
@Controller('quizzes')
export class QuizCommentController {
  constructor(
    private readonly application: CommentApplicationService,
    private readonly presenter: CommentPresenter,
  ) {}

  @Get(':quizId/comments')
  @Public()
  @ApiListQuizCommentsResponses()
  async listQuizComments(
    @OptionalCurrentUser() viewer: JwtPayload | undefined,
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    const result = await this.application.listQuizComments(viewer, quizId, query);
    return this.presenter.listQuizComments(result);
  }

  @Post(':quizId/comments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateCommentResponses()
  async createComment(
    @CurrentUser() user: JwtPayload,
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @Body() dto: CreateCommentDto,
  ) {
    const view = await this.application.createComment(user, quizId, dto);
    return this.presenter.createComment(view);
  }
}
