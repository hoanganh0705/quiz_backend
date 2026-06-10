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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
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
import { AttemptDomainExceptionFilter } from '../filters/attempt-domain-exception.filter';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller()
@UseFilters(AttemptDomainExceptionFilter)
export class AttemptController {
  constructor(private readonly attemptApplicationService: AttemptApplicationService) {}

  @Post('quizzes/:quizId/attempts')
  @ApiAuth()
  @ApiOperation({
    summary: 'Start quiz attempt',
    description:
      'Resolves the published quiz version from the quizId and starts a new attempt for the authenticated user.',
  })
  @ApiCreatedResponse({ description: 'Attempt started', type: AttemptResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found or has no published version' })
  @ApiConflictResponse({ description: 'You already have an active attempt for this quiz' })
  @ApiBadRequestResponse({ description: 'Validation failed or quiz is not available for attempts' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async startAttempt(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: StartAttemptDto,
  ): Promise<AttemptResponseDto> {
    return this.attemptApplicationService.startAttempt(quizId, user, payload);
  }

  @Get('attempts/:attemptId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get attempt by ID',
    description:
      'Returns the full attempt record including all answers for the authenticated user.',
  })
  @ApiOkResponse({ description: 'Attempt found', type: AttemptResponseDto })
  @ApiNotFoundResponse({ description: 'Attempt not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
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
  @ApiCreatedResponse({ description: 'Answer recorded', type: SubmitAnswerResponseDto })
  @ApiNotFoundResponse({ description: 'Attempt or question not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
  @ApiAuth()
  @ApiOperation({
    summary: 'Withdraw answer',
    description:
      'Deletes a previously submitted answer from an active attempt, allowing the user to skip or change their answer.',
  })
  @ApiOkResponse({ description: 'Answer withdrawn', type: WithdrawAnswerResponseDto })
  @ApiNotFoundResponse({ description: 'Attempt or answer not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async withdrawAnswer(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WithdrawAnswerResponseDto> {
    return this.attemptApplicationService.withdrawAnswer(attemptId, questionId, user);
  }

  @Post('attempts/:attemptId/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({
    summary: 'Abandon attempt',
    description:
      'Marks an in-progress attempt as abandoned. No XP is earned. The attempt cannot be resumed.',
  })
  @ApiOkResponse({ description: 'Attempt abandoned', type: AbandonAttemptResponseDto })
  @ApiNotFoundResponse({ description: 'Attempt not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async abandonAttempt(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AbandonAttemptResponseDto> {
    return this.attemptApplicationService.abandonAttempt(attemptId, user);
  }

  @Post('attempts/:attemptId/complete')
  @ApiAuth()
  @ApiOperation({
    summary: 'Complete attempt',
    description:
      'Manually finalizes an attempt and calculates the score. XP is awarded based on the result.',
  })
  @ApiOkResponse({ description: 'Attempt completed', type: CompleteAttemptResponseDto })
  @ApiNotFoundResponse({ description: 'Attempt not found' })
  @ApiConflictResponse({ description: 'Attempt is not in an active state' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async completeAttempt(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompleteAttemptResponseDto> {
    return this.attemptApplicationService.completeAttempt(attemptId, user);
  }

  @Get('users/me/attempts')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my attempts',
    description:
      'Returns a cursor-paginated list of quiz attempts for the authenticated user with optional filters for status, quiz, category, tag, and date range, plus sorting by created time, completion time, or score.',
  })
  @ApiOkResponse({ description: 'Attempts returned', type: AttemptListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
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
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my attempt stats',
    description:
      'Returns aggregated statistics across all attempts owned by the authenticated user, including status counts, averages, total time spent, favorite category/tag, and the latest attempt timestamp.',
  })
  @ApiOkResponse({ description: 'Attempt statistics returned', type: UserAttemptStatsResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getMyAttemptStats(@CurrentUser() user: JwtPayload): Promise<UserAttemptStatsResponseDto> {
    return this.attemptApplicationService.getMyAttemptStats(user);
  }

  @Get('attempts/:attemptId/answers')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get attempt answers',
    description:
      'Returns all answers submitted within a specific attempt. Only the attempt owner or an admin may access this endpoint.',
  })
  @ApiOkResponse({
    description: 'Answers returned',
    type: AttemptAnswersResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Attempt not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getAttemptAnswers(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AttemptAnswersResponseDto> {
    return this.attemptApplicationService.getAttemptAnswers(attemptId, user);
  }

  @Get('attempts/:attemptId/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get attempt analytics',
    description:
      'Returns detailed analytics for a completed attempt, including score, accuracy, answer breakdown, ' +
      'time spent, and percentile rank against all other completed attempts for the same quiz version. ' +
      'Attempt must be completed and must belong to the current user.',
  })
  @ApiOkResponse({
    description: 'Analytics returned',
    type: AttemptAnalyticsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Attempt not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getAttemptAnalytics(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AttemptAnalyticsResponseDto> {
    return this.attemptApplicationService.getAttemptAnalytics(attemptId, user);
  }
}
