/**
 * Comment Controller
 *
 * Routes for single-comment operations:
 *   - `GET    /comments/:commentId`  — read a single comment
 *   - `PATCH  /comments/:commentId`  — edit own comment
 *   - `DELETE /comments/:commentId`  — soft-delete own comment
 *   - `PUT    /comments/:commentId/vote`     — cast / flip / toggle vote
 *   - `DELETE /comments/:commentId/vote`     — remove vote
 *   - `POST   /comments/:commentId/reports`  — open a report
 *   - `POST   /comments/:commentId/hide`     — moderator hide
 *   - `POST   /comments/:commentId/restore`  — moderator restore
 *
 * Quiz-anchored reads (`GET /quizzes/:quizId/comments`) and creates
 * (`POST /quizzes/:quizId/comments`) live in
 * `quiz-comment.controller.ts`. User-anchored lists
 * (`GET /users/me/comments`, `GET /users/:userId/comments`) live in
 * `user-comment.controller.ts`.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser, OptionalCurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CommentApplicationService } from '../../application/comment-application.service';
import { CommentPresenter } from '../presenters/comment.presenter';
import { CommentNotFoundError } from '../../domain/errors';
import {
  EditCommentDto,
  VoteDto,
  ReportCommentDto,
} from '../../dto/request';

@ApiTags('comments')
@Controller('comments')
export class CommentController {
  constructor(
    private readonly application: CommentApplicationService,
    private readonly presenter: CommentPresenter,
  ) {}

  @Get(':commentId')
  @Public()
  async getComment(
    @OptionalCurrentUser() viewer: JwtPayload | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ) {
    const view = await this.application.getComment(viewer, commentId);
    if (view === null) {
      throw new CommentNotFoundError(commentId);
    }
    return this.presenter.getComment(view);
  }

  @Patch(':commentId')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async editComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
    @Body() dto: EditCommentDto,
  ) {
    const view = await this.application.editComment(user, commentId, dto);
    return this.presenter.editComment(view);
  }

  @Delete(':commentId')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ): Promise<void> {
    await this.application.deleteComment(user, commentId);
  }

  @Put(':commentId/vote')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async vote(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
    @Body() dto: VoteDto,
  ): Promise<void> {
    await this.application.vote(user, commentId, dto.value);
  }

  @Delete(':commentId/vote')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVote(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ): Promise<void> {
    await this.application.removeVote(user, commentId);
  }

  @Post(':commentId/reports')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async reportComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
    @Body() dto: ReportCommentDto,
  ) {
    const report = await this.application.reportComment(user, commentId, dto);
    return this.presenter.createReport(report);
  }

  @Post(':commentId/hide')
  @ApiBearerAuth()
  @Permissions(Permission.DISCUSSION_MODERATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async hideComment(
    @CurrentUser() moderator: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ): Promise<void> {
    await this.application.hideComment(moderator, commentId);
  }

  @Post(':commentId/restore')
  @ApiBearerAuth()
  @Permissions(Permission.DISCUSSION_MODERATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreComment(
    @CurrentUser() moderator: JwtPayload,
    @Param('commentId', new ParseUUIDPipe({ version: '7' })) commentId: string,
  ): Promise<void> {
    await this.application.restoreComment(moderator, commentId);
  }
}
