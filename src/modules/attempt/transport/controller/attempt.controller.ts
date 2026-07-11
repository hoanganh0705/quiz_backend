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
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
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
} from '../../dto/response';

@ApiTags('attempts')
@Controller()
export class AttemptController {
  constructor(
    private readonly attemptApplicationService: AttemptApplicationService,
    private readonly presenter: AttemptPresenter,
  ) {}

  @Post('quizzes/:quizId/attempts')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOperation({
    summary: 'Start quiz attempt',
    description:
      'Resolves the published quiz version from the quizId and starts a new attempt for the authenticated user.',
  })
  @ApiCreatedResource(AttemptResponseDto, { description: 'Attempt started' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiBadRequestResponse({ description: 'Request body or path param failed validation' })
  @ApiUnprocessableEntityResponse({
    description:
      'Quiz is not published, has no published version, or cannot be attempted (e.g. insufficient questions)',
  })
  @ApiConflictResponse({ description: 'You already have an active attempt for this quiz' })
  @ApiInternalServerErrorResponse()
  async startAttempt(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: StartAttemptDto,
  ) {
    const result = await this.attemptApplicationService.startAttempt(quizId, user, payload);
    return this.presenter.startAttempt(result);
  }

  @Get('attempts/:attemptId')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResource(AttemptResponseDto, { description: 'Attempt found' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
  })
  @ApiNotFoundResponse({ description: 'Quiz attempt not found' })
  @ApiBadRequestResponse({ description: 'Path param is not a valid UUID' })
  @ApiInternalServerErrorResponse()
  async getAttemptById(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
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
  @ApiCreatedResource(SubmitAnswerResponseDto, { description: 'Answer recorded' })
  @ApiForbiddenResponse({ description: 'You do not have permission to access this attempt' })
  @ApiNotFoundResponse({ description: 'Attempt or question not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiUnprocessableEntityResponse({ description: 'Question is invalid for this attempt' })
  @ApiBadRequestResponse({ description: 'Path param or request body failed validation' })
  @ApiInternalServerErrorResponse()
  async submitAnswer(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
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
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResource(WithdrawAnswerResponseDto, { description: 'Answer withdrawn' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
  })
  @ApiBadRequestResponse({ description: 'Path param is not a valid UUID' })
  @ApiConflictResponse({
    description: 'Attempt is not in an active state',
    type: ProblemDetailDto,
  })
  @ApiInternalServerErrorResponse()
  async withdrawAnswer(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
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
  })
  @ApiOkResource(AbandonAttemptResponseDto, { description: 'Attempt abandoned' })
  @ApiNotFoundResponse({ description: 'Quiz attempt not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiBadRequestResponse({ description: 'Path param is not a valid UUID' })
  @ApiInternalServerErrorResponse()
  async abandonAttempt(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
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
  @ApiCreatedResource(CompleteAttemptResponseDto, { description: 'Attempt completed' })
  @ApiForbiddenResponse({ description: 'You do not have permission to access this attempt' })
  @ApiNotFoundResponse({ description: 'Quiz attempt not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiInternalServerErrorResponse()
  async completeAttempt(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.completeAttempt(attemptId, user);
    return this.presenter.completeAttempt(result);
  }

  @Get('users/me/attempts')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResourceList(AttemptListResponseDto, 'cursor', { description: 'Attempts returned' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiBadRequestResponse({ description: 'Query parameters failed validation' })
  @ApiInternalServerErrorResponse()
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
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResource(UserAttemptStatsResponseDto, { description: 'Attempt statistics returned' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiInternalServerErrorResponse()
  async getMyAttemptStats(@CurrentUser() user: JwtPayload) {
    const result = await this.attemptApplicationService.getMyAttemptStats(user);
    return this.presenter.getMyAttemptStats(result);
  }

  @Get('attempts/:attemptId/answers')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResource(AttemptAnswersResponseDto, { description: 'Answers returned' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
  })
  @ApiNotFoundResponse({ description: 'Quiz attempt not found' })
  @ApiBadRequestResponse({ description: 'Path param is not a valid UUID' })
  @ApiInternalServerErrorResponse()
  async getAttemptAnswers(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.getAttemptAnswers(attemptId, user);
    return this.presenter.getAttemptAnswers(result);
  }

  @Get('attempts/:attemptId/analytics')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResource(AttemptAnalyticsResponseDto, { description: 'Analytics returned' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own this attempt',
    type: ProblemDetailDto,
  })
  @ApiNotFoundResponse({ description: 'Quiz attempt not found' })
  @ApiBadRequestResponse({ description: 'Path param is not a valid UUID' })
  @ApiUnprocessableEntityResponse({
    description: 'Analytics are only available for completed attempts',
  })
  @ApiInternalServerErrorResponse()
  async getAttemptAnalytics(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.attemptApplicationService.getAttemptAnalytics(attemptId, user);
    return this.presenter.getAttemptAnalytics(result);
  }
}
