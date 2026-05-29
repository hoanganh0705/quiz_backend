import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnprocessableEntityResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '@/common/swagger/swagger-schemas';
import { QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE } from '../../quiz.constants';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizVersionApplicationService } from '../../application/quiz-version.application.service';
import { UpdateQuizVersionDto } from '../../dto/request/update-quiz-version.dto';
import { QuizVersionResponseDto } from '../../dto/response/quiz-version-response.dto';
import { QuizDomainExceptionFilter } from '../filters/quiz-domain-exception.filter';

@ApiTags('quizzes')
@Controller('quiz-versions')
@UseFilters(QuizDomainExceptionFilter)
export class QuizVersionController {
  constructor(private readonly quizVersionApplicationService: QuizVersionApplicationService) {}

  @Patch(':id')
  @Permissions(Permission.QUIZ_VERSION_EDIT_OWN, Permission.QUIZ_VERSION_EDIT_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Update quiz version',
    description:
      "Updates a quiz version's metadata (difficulty, duration, passing score, XP reward). Requires `quiz-version:edit:own` or `quiz-version:edit:any`.",
  })
  @ApiOkResponse({ description: 'Version updated', type: QuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to edit this quiz version' })
  @ApiBadRequestResponse({ description: 'Validation failed or quiz version is not editable' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    return this.quizVersionApplicationService.updateQuizVersion(quizVersionId, user, payload);
  }

  @Post(':id/publish')
  @Permissions(Permission.QUIZ_VERSION_PUBLISH_OWN, Permission.QUIZ_VERSION_PUBLISH_ANY)
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Publish quiz version',
    description: `Publishes a draft quiz version, making it available for attempts. Only one version per quiz can be published at a time. The version must contain at least ${5} questions. Requires \`quiz-version:publish:own\` or \`quiz-version:publish:any\`.`,
  })
  @ApiOkResponse({ description: 'Version published', type: QuizVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to publish this quiz version' })
  @ApiUnprocessableEntityResponse({
    description: `Business rule violated: ${QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE}`,
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  publishQuizVersion(
    @Param('id', new ParseUUIDPipe()) quizVersionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuizVersionResponseDto> {
    return this.quizVersionApplicationService.publishQuizVersion(quizVersionId, user);
  }
}
