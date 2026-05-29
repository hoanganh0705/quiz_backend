import {
  Body,
  Controller,
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
    description: 'Returns a paginated list of all quiz attempts for the authenticated user.',
  })
  @ApiOkResponse({ description: 'Attempts returned', type: AttemptListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listMyAttempts(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyAttemptsQueryDto,
  ): Promise<AttemptListResponseDto> {
    const limit = query.limit ?? 20;
    return this.attemptApplicationService.listMyAttempts(user, limit);
  }
}
