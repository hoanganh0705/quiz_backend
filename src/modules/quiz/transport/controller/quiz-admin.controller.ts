import { Body, Controller, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { Permission } from '@/common/authorization/permissions';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ParseUUIDOrSlugPipe } from '@/common/pipes/parse-uuid-or-slug.pipe';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';

import { QuizApplicationService } from '../../application/quiz.application.service';
import { QuizPresenter } from '../presenters/quiz.presenter';
import { QuizResponseDto } from '../../dto/response/quiz-response.dto';
import { AdminUpdateQuizDto } from '../../dto/request/admin-update-quiz.dto';

@ApiTags('admin-quizzes')
@Controller({ path: 'admin/quizzes', version: '1' })
@Permissions(Permission.QUIZ_VERIFY)
export class QuizAdminController {
  constructor(
    private readonly quizApplicationService: QuizApplicationService,
    private readonly presenter: QuizPresenter,
  ) {}

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin-only update of privileged quiz fields',
    description:
      'Allows admins to flip the `isFeatured` and `isHidden` flags without going through ' +
      'the regular creator-side update endpoint, which intentionally strips those fields.',
  })
  @ApiOkResponse({ description: 'Quiz updated.', type: QuizResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @ApiForbiddenResponse({ description: 'Caller lacks the QUIZ_VERIFY permission.' })
  @ApiNotFoundResponse({ description: 'Quiz not found.' })
  async adminUpdate(
    @CurrentUser() admin: JwtPayload,
    @Param('id', new ParseUUIDOrSlugPipe()) id: string,
    @Body() body: AdminUpdateQuizDto,
  ): Promise<ApiResponseEnvelope<QuizResponseDto>> {
    const result = await this.quizApplicationService.adminUpdatePrivilegedFields({
      actor: admin,
      quizIdOrSlug: id,
      isFeatured: body.isFeatured,
      isHidden: body.isHidden,
    });
    return this.presenter.updateQuiz(result);
  }
}
