import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Permission } from '@/common/authz/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { UpdateQuizVersionDto } from './dto/request/update-quiz-version.dto';
import { QuizVersionResponseDto } from './dto/response/quiz-version-response.dto';
import { QuizService } from './quiz.service';

@Controller('quiz-versions')
@UseGuards(PermissionsGuard)
export class QuizVersionController {
  constructor(private readonly quizService: QuizService) {}

  @Patch(':id')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  updateQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizService.updateQuizVersion(quizVersionId, user, payload);
  }

  @Post(':id/publish')
  @Permissions(Permission.QUIZ_VERSION_PUBLISH_OWN, Permission.QUIZ_VERSION_PUBLISH_ANY)
  publishQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    return this.quizService.publishQuizVersion(quizVersionId, user);
  }
}
