import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseFilters } from '@nestjs/common';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizApplicationService } from '../../application/quiz.application.service';
import { UpdateQuizVersionDto } from '../../dto/request/update-quiz-version.dto';
import { QuizVersionResponseDto } from '../../dto/response/quiz-version-response.dto';
import { QuizDomainExceptionFilter } from '../filters/quiz-domain-exception.filter';

@Controller('quiz-versions')
@UseFilters(QuizDomainExceptionFilter)
export class QuizVersionController {
  constructor(private readonly quizApplicationService: QuizApplicationService) {}

  @Patch(':id')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  updateQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizApplicationService.updateQuizVersion(quizVersionId, user, payload);
  }

  @Post(':id/publish')
  @Permissions(Permission.QUIZ_VERSION_PUBLISH_OWN, Permission.QUIZ_VERSION_PUBLISH_ANY)
  publishQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    return this.quizApplicationService.publishQuizVersion(quizVersionId, user);
  }
}
