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
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
  ApiUnprocessableEntityResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiAuthAction } from '@/common/swagger/swagger-decorators';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { AttemptApplicationService } from '../../application/attempt.application.service';
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
import {
  AttemptWrappedAttemptDto,
  AttemptWrappedSubmitAnswerDto,
  AttemptWrappedWithdrawAnswerDto,
  AttemptWrappedAbandonAttemptDto,
  AttemptWrappedCompleteAttemptDto,
  AttemptWrappedAnswersDto,
  AttemptWrappedAnalyticsDto,
  AttemptWrappedUserStatsDto,
  AttemptWrappedListDto,
} from '../../dto/response/attempt-response-docs.dto';
import { AttemptDomainExceptionFilter } from '../filters/attempt-domain-exception.filter';

@ApiTags('attempts')
@Controller()
@UseFilters(AttemptDomainExceptionFilter)
export class AttemptController {
  constructor(private readonly attemptApplicationService: AttemptApplicationService) {}

  @Post('quizzes/:quizId/attempts')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOperation({
    summary: 'Start quiz attempt',
    description:
      'Resolves the published quiz version from the quizId and starts a new attempt for the authenticated user.',
  })
  @ApiCreatedResponse({ description: 'Attempt started', type: AttemptWrappedAttemptDto })
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
  ): Promise<AttemptResponseDto> {
    return this.attemptApplicationService.startAttempt(quizId, user, payload);
  }

  @Get('attempts/:attemptId')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResponse({ description: 'Attempt found', type: AttemptWrappedAttemptDto })
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
  ): Promise<AttemptResponseDto> {
    return this.attemptApplicationService.getAttemptById(attemptId, user);
  }

  @Post('attempts/:attemptId/answers')
  @HttpCode(HttpStatus.CREATED)
  @ApiAuth()
  @ApiOperation({
    summary: 'Submit answer',
    description: 'Creates an answer record for a specific question within an active attempt.',
  })
  @ApiCreatedResponse({
    description: 'Answer recorded',
    type: AttemptWrappedSubmitAnswerDto,
  })
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
  ): Promise<SubmitAnswerResponseDto> {
    return this.attemptApplicationService.submitAnswer(
      attemptId,
      payload.questionId,
      payload.selectedOptionId ?? null,
      payload.timeTakenMs,
      user,
    );
  }

  @Delete('attempts/:attemptId/answers/:questionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResponse({
    description: 'Answer withdrawn',
    type: AttemptWrappedWithdrawAnswerDto,
  })
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
  ): Promise<WithdrawAnswerResponseDto> {
    return this.attemptApplicationService.withdrawAnswer(attemptId, questionId, user);
  }

  @Post('attempts/:attemptId/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiAuthAction({ description: 'Attempt abandoned', type: AttemptWrappedAbandonAttemptDto })
  @ApiForbiddenResponse({ description: 'You do not have permission to access this attempt' })
  @ApiNotFoundResponse({ description: 'Quiz attempt not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiInternalServerErrorResponse()
  async abandonAttempt(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AbandonAttemptResponseDto> {
    return this.attemptApplicationService.abandonAttempt(attemptId, user);
  }

  @Post('attempts/:attemptId/complete')
  @ApiAuth()
  @ApiOperation({
    summary: 'Complete quiz attempt',
    description:
      'Finalizes the attempt, computes the score, awards XP, and writes side effects. ' +
      'Only the owner (or an admin) of an attempt with status "started" can complete it.',
  })
  @ApiCreatedResponse({
    description: 'Attempt completed',
    type: AttemptWrappedCompleteAttemptDto,
  })
  @ApiForbiddenResponse({ description: 'You do not have permission to access this attempt' })
  @ApiNotFoundResponse({ description: 'Quiz attempt not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiInternalServerErrorResponse()
  async completeAttempt(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompleteAttemptResponseDto> {
    return this.attemptApplicationService.completeAttempt(attemptId, user);
  }

  @Get('users/me/attempts')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResponse({ description: 'Attempts returned', type: AttemptWrappedListDto })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiBadRequestResponse({ description: 'Query parameters failed validation' })
  @ApiInternalServerErrorResponse()
  async listMyAttempts(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyAttemptsQueryDto,
  ): Promise<AttemptListResponseDto> {
    return this.attemptApplicationService.listMyAttempts(user, {
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
  }

  @Get('users/me/attempts/stats')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResponse({
    description: 'Attempt statistics returned',
    type: AttemptWrappedUserStatsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    type: ProblemDetailDto,
  })
  @ApiInternalServerErrorResponse()
  async getMyAttemptStats(@CurrentUser() user: JwtPayload): Promise<UserAttemptStatsResponseDto> {
    return this.attemptApplicationService.getMyAttemptStats(user);
  }

  @Get('attempts/:attemptId/answers')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResponse({ description: 'Answers returned', type: AttemptWrappedAnswersDto })
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
  ): Promise<AttemptAnswersResponseDto> {
    return this.attemptApplicationService.getAttemptAnswers(attemptId, user);
  }

  @Get('attempts/:attemptId/analytics')
  @ApiBearerAuth(AUTH_SECURITY_NAME)
  @ApiOkResponse({ description: 'Analytics returned', type: AttemptWrappedAnalyticsDto })
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
  ): Promise<AttemptAnalyticsResponseDto> {
    return this.attemptApplicationService.getAttemptAnalytics(attemptId, user);
  }
}
