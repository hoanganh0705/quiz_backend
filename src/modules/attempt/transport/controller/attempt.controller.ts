import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
  ApiUnprocessableEntityResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { AttemptApplicationService } from '../../application/attempt.application.service';
import { AttemptPresenter } from '../presenters/attempt.presenter';
import { StartAttemptDto, ListMyAttemptsQueryDto, SubmitAnswerDto } from '../../dto/request';
import {
  AttemptResponseDto,
  AttemptListResponseDto,
  SubmitAnswerResponseDto,
  AbandonAttemptResponseDto,
  CompleteAttemptResponseDto,
  WithdrawAnswerResponseDto,
  AttemptAnswersResponseDto,
  AttemptAnalyticsResponseDto,
  UserAttemptStatsResponseDto,
  AttemptReviewResponseDto,
} from '../../dto/response';
import {
  startAttemptBadRequestExample,
  startAttemptConflictExample,
  startAttemptUnprocessableExample,
  startAttemptInternalErrorExample,
  getAttemptNotFoundExample,
  getAttemptForbiddenExample,
  getAttemptBadRequestExample,
  getAttemptInternalErrorExample,
  submitAnswerBadRequestExample,
  submitAnswerNotFoundExample,
  submitAnswerForbiddenExample,
  submitAnswerConflictExample,
  submitAnswerUnprocessableExample,
  submitAnswerInternalErrorExample,
  withdrawAnswerBadRequestExample,
  withdrawAnswerForbiddenExample,
  withdrawAnswerNotFoundExample,
  withdrawAnswerConflictExample,
  withdrawAnswerInternalErrorExample,
  abandonAttemptNotFoundExample,
  abandonAttemptForbiddenExample,
  abandonAttemptConflictExample,
  abandonAttemptBadRequestExample,
  abandonAttemptInternalErrorExample,
  completeAttemptNotFoundExample,
  completeAttemptForbiddenExample,
  completeAttemptConflictExample,
  completeAttemptBadRequestExample,
  completeAttemptInternalErrorExample,
  listMyAttemptsBadRequestExample,
  listMyAttemptsInternalErrorExample,
  getMyAttemptStatsInternalErrorExample,
  getAttemptAnswersNotFoundExample,
  getAttemptAnswersForbiddenExample,
  getAttemptAnswersBadRequestExample,
  getAttemptAnswersInternalErrorExample,
  getAttemptAnalyticsNotFoundExample,
  getAttemptAnalyticsForbiddenExample,
  getAttemptAnalyticsBadRequestExample,
  getAttemptAnalyticsUnprocessableExample,
  getAttemptAnalyticsInternalErrorExample,
  getAttemptReviewNotFoundExample,
  getAttemptReviewForbiddenExample,
  getAttemptReviewBadRequestExample,
  getAttemptReviewUnprocessableExample,
  getAttemptReviewInternalErrorExample,
} from '../swagger/examples/errors.examples';

@ApiTags('attempts')
@Controller()
export class AttemptController {
  constructor(
    private readonly attemptApplicationService: AttemptApplicationService,
    private readonly presenter: AttemptPresenter,
  ) {}

  @Post('quizzes/:quizId/attempts')
  @ApiAuth()
  @ApiOperation({
    summary: 'Start quiz attempt',
    description:
      'Resolves the published quiz version from the quizId and starts a new attempt for the authenticated user.',
  })
  @ApiParam({
    name: 'quizId',
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @ApiCreatedResource(AttemptResponseDto, { description: 'Attempt started' })
  @ApiBadRequestResponse({
    description: 'Request body or path param failed validation',
    type: ProblemDetailDto,
    example: startAttemptBadRequestExample,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Quiz is not published, has no published version, or cannot be attempted (e.g. insufficient questions)',
    type: ProblemDetailDto,
    example: startAttemptUnprocessableExample,
  })
  @ApiConflictResponse({
    description: 'You already have an active attempt for this quiz',
    type: ProblemDetailDto,
    example: startAttemptConflictExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: startAttemptInternalErrorExample,
  })
  async startAttempt(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: StartAttemptDto,
  ) {
    const result = await this.attemptApplicationService.startAttempt(quizId, user, payload);
    return this.presenter.startAttempt(result);
  }

  @Get('attempts/:attemptId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get attempt by ID',
    description:
      'Retrieves a single quiz attempt by its identifier. Only accessible by the attempt owner or admin.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiOkResource(AttemptResponseDto, { description: 'Attempt found' })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
    example: getAttemptForbiddenExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz attempt not found',
    type: ProblemDetailDto,
    example: getAttemptNotFoundExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param is not a valid UUID',
    type: ProblemDetailDto,
    example: getAttemptBadRequestExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: getAttemptInternalErrorExample,
  })
  async getAttemptById(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.getAttemptById(attemptId, user);
    return this.presenter.getAttemptById(result);
  }

  @Post('attempts/:attemptId/answers')
  @HttpCode(HttpStatus.CREATED)
  @ApiAuth()
  @ApiOperation({
    summary: 'Submit answer',
    description: 'Creates an answer record for a specific question within an active attempt.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiCreatedResource(SubmitAnswerResponseDto, { description: 'Answer recorded' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to access this attempt',
    type: ProblemDetailDto,
    example: submitAnswerForbiddenExample,
  })
  @ApiNotFoundResponse({
    description: 'Attempt or question not found',
    type: ProblemDetailDto,
    example: submitAnswerNotFoundExample,
  })
  @ApiConflictResponse({
    description: 'Attempt is not in an active state',
    type: ProblemDetailDto,
    example: submitAnswerConflictExample,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Question is invalid for this attempt',
    type: ProblemDetailDto,
    example: submitAnswerUnprocessableExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param or request body failed validation',
    type: ProblemDetailDto,
    example: submitAnswerBadRequestExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: submitAnswerInternalErrorExample,
  })
  async submitAnswer(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: SubmitAnswerDto,
  ) {
    const result = await this.attemptApplicationService.submitAnswer(
      attemptId,
      payload.questionId,
      payload.selectedOptionId ?? null,
      payload.timeTakenMs,
      user,
    );
    return this.presenter.submitAnswer(result);
  }

  @Delete('attempts/:attemptId/answers/:questionId')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({
    summary: 'Withdraw answer',
    description: 'Removes a previously submitted answer from an active attempt.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiParam({
    name: 'questionId',
    description: 'Question identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440001',
  })
  @ApiOkResource(WithdrawAnswerResponseDto, { description: 'Answer withdrawn' })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
    example: withdrawAnswerForbiddenExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param is not a valid UUID',
    type: ProblemDetailDto,
    example: withdrawAnswerBadRequestExample,
  })
  @ApiNotFoundResponse({
    description: 'Answer to withdraw not found',
    type: ProblemDetailDto,
    example: withdrawAnswerNotFoundExample,
  })
  @ApiConflictResponse({
    description: 'Attempt is not in an active state',
    type: ProblemDetailDto,
    example: withdrawAnswerConflictExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: withdrawAnswerInternalErrorExample,
  })
  async withdrawAnswer(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @Param('questionId', new ParseUUIDPipe({ version: '7' })) questionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.withdrawAnswer(attemptId, questionId, user);
    return this.presenter.withdrawAnswer(result);
  }

  @Post('attempts/:attemptId/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({
    summary: 'Abandon quiz attempt',
    description:
      'Abandons an active quiz attempt. No score or XP is awarded for abandoned attempts.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiOkResource(AbandonAttemptResponseDto, { description: 'Attempt abandoned' })
  @ApiNotFoundResponse({
    description: 'Quiz attempt not found',
    type: ProblemDetailDto,
    example: abandonAttemptNotFoundExample,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
    example: abandonAttemptForbiddenExample,
  })
  @ApiConflictResponse({
    description: 'Attempt is not in an active state',
    type: ProblemDetailDto,
    example: abandonAttemptConflictExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param is not a valid UUID',
    type: ProblemDetailDto,
    example: abandonAttemptBadRequestExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: abandonAttemptInternalErrorExample,
  })
  async abandonAttempt(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.abandonAttempt(attemptId, user);
    return this.presenter.abandonAttempt(result);
  }

  @Post('attempts/:attemptId/complete')
  @ApiAuth()
  @ApiOperation({
    summary: 'Complete quiz attempt',
    description:
      'Finalizes the attempt, computes the score, awards XP, and writes side effects. ' +
      'Only the owner (or an admin) of an attempt with status "started" can complete it.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiOkResource(CompleteAttemptResponseDto, { description: 'Attempt completed' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to access this attempt',
    type: ProblemDetailDto,
    example: completeAttemptForbiddenExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz attempt not found',
    type: ProblemDetailDto,
    example: completeAttemptNotFoundExample,
  })
  @ApiConflictResponse({
    description: 'Attempt is not in an active state',
    type: ProblemDetailDto,
    example: completeAttemptConflictExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param is not a valid UUID',
    type: ProblemDetailDto,
    example: completeAttemptBadRequestExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: completeAttemptInternalErrorExample,
  })
  async completeAttempt(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.completeAttempt(attemptId, user);
    return this.presenter.completeAttempt(result);
  }

  @Get('users/me/attempts')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my attempts',
    description:
      'Returns a cursor-paginated list of attempts for the authenticated user. Supports filtering by status, quiz, category, tag, and date range.',
  })
  @ApiOkResourceList(AttemptListResponseDto, 'cursor', { description: 'Attempts returned' })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: listMyAttemptsBadRequestExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: listMyAttemptsInternalErrorExample,
  })
  async listMyAttempts(@CurrentUser() user: JwtPayload, @Query() query: ListMyAttemptsQueryDto) {
    const result = await this.attemptApplicationService.listMyAttempts(user, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      status: query.status,
      quizId: query.quizId,
      categoryId: query.categoryId,
      tagId: query.tagId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      sortBy: query.sortBy,
    });
    return this.presenter.listMyAttempts(result);
  }

  @Get('users/me/attempts/stats')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my attempt statistics',
    description:
      'Returns aggregated statistics for the authenticated user, including total attempts, average score, total time spent, and favorite category/tag.',
  })
  @ApiOkResource(UserAttemptStatsResponseDto, { description: 'Attempt statistics returned' })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: getMyAttemptStatsInternalErrorExample,
  })
  async getMyAttemptStats(@CurrentUser() user: JwtPayload) {
    const result = await this.attemptApplicationService.getMyAttemptStats(user);
    return this.presenter.getMyAttemptStats(result);
  }

  @Get('attempts/:attemptId/answers')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get attempt answers',
    description:
      'Returns all submitted answers for a specific attempt as raw submission records. ' +
      'Per-question correctness is intentionally not exposed by this endpoint; ' +
      'use GET /attempts/{attemptId}/analytics for aggregate scoring data.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiOkResource(AttemptAnswersResponseDto, { description: 'Answers returned' })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
    example: getAttemptAnswersForbiddenExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz attempt not found',
    type: ProblemDetailDto,
    example: getAttemptAnswersNotFoundExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param is not a valid UUID',
    type: ProblemDetailDto,
    example: getAttemptAnswersBadRequestExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: getAttemptAnswersInternalErrorExample,
  })
  async getAttemptAnswers(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.getAttemptAnswers(attemptId, user);
    return this.presenter.getAttemptAnswers(result);
  }

  @Get('attempts/:attemptId/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get attempt analytics',
    description:
      'Returns detailed analytics for a completed attempt, including score, accuracy, percentile rank, and time spent. ' +
      'Analytics are only available for completed attempts.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiOkResource(AttemptAnalyticsResponseDto, { description: 'Analytics returned' })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
    example: getAttemptAnalyticsForbiddenExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz attempt not found',
    type: ProblemDetailDto,
    example: getAttemptAnalyticsNotFoundExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param is not a valid UUID',
    type: ProblemDetailDto,
    example: getAttemptAnalyticsBadRequestExample,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Analytics are only available for completed attempts',
    type: ProblemDetailDto,
    example: getAttemptAnalyticsUnprocessableExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: getAttemptAnalyticsInternalErrorExample,
  })
  async getAttemptAnalytics(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.getAttemptAnalytics(attemptId, user);
    return this.presenter.getAttemptAnalytics(result);
  }

  @Get('attempts/:attemptId/review')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get post-attempt review',
    description:
      "Returns a per-question debrief for a completed attempt, including the user's selected " +
      'option, whether it was correct, and the full option set with `isCorrect` flags. ' +
      'Only available for completed attempts — in-progress or abandoned attempts return 422. ' +
      'Use this to render a "review your answers" experience after a user finishes a quiz.',
  })
  @ApiParam({
    name: 'attemptId',
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  @ApiOkResource(AttemptReviewResponseDto, { description: 'Review returned' })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
    example: getAttemptReviewForbiddenExample,
  })
  @ApiNotFoundResponse({
    description: 'Quiz attempt not found',
    type: ProblemDetailDto,
    example: getAttemptReviewNotFoundExample,
  })
  @ApiBadRequestResponse({
    description: 'Path param is not a valid UUID',
    type: ProblemDetailDto,
    example: getAttemptReviewBadRequestExample,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Review is only available for completed attempts',
    type: ProblemDetailDto,
    example: getAttemptReviewUnprocessableExample,
  })
  @ApiInternalServerErrorResponse({
    type: ProblemDetailDto,
    example: getAttemptReviewInternalErrorExample,
  })
  async getAttemptReview(
    @Param('attemptId', new ParseUUIDPipe({ version: '7' })) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.getAttemptReview(attemptId, user);
    return this.presenter.getAttemptReview(result);
  }
}
