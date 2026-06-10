import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { AttemptCommandService } from '../domain/attempt-command.service';
import { AttemptQueryService } from '../domain/attempt-query.service';
import { AttemptResponseMapper } from '../mappers/attempt-response.mapper';
import { AttemptCursorMapper, type AttemptListSortField } from '../mappers/attempt-cursor.mapper';
import { StartAttemptDto } from '../dto/request';
import {
  AttemptResponseDto,
  AttemptListResponseDto,
  SubmitAnswerResponseDto,
  AbandonAttemptResponseDto,
  CompleteAttemptResponseDto,
  AttemptAnswersResponseDto,
  AttemptAnalyticsResponseDto,
  UserAttemptStatsResponseDto,
} from '../dto/response';

@Injectable()
export class AttemptApplicationService {
  constructor(
    private readonly attemptCommandService: AttemptCommandService,
    private readonly attemptQueryService: AttemptQueryService,
    private readonly attemptResponseMapper: AttemptResponseMapper,
  ) {}

  async startAttempt(
    quizId: string,
    user: JwtPayload,
    payload: StartAttemptDto,
  ): Promise<AttemptResponseDto> {
    const attempt = await this.attemptCommandService.startAttempt(
      quizId,
      user,
      payload.contextType ?? 'solo',
      payload.contextRefId ?? null,
    );

    const detail = await this.attemptQueryService.getAttemptById(attempt.attemptId, user);
    const answers = await this.attemptQueryService.getAnswersByAttemptId(attempt.attemptId);

    return this.attemptResponseMapper.toAttemptDetailResponse(detail, answers);
  }

  async getAttemptById(attemptId: string, user: JwtPayload): Promise<AttemptResponseDto> {
    const attempt = await this.attemptQueryService.getAttemptById(attemptId, user);
    const answers = await this.attemptQueryService.getAnswersByAttemptId(attemptId);

    return this.attemptResponseMapper.toAttemptDetailResponse(attempt, answers);
  }

  async submitAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionId: string | null,
    timeTakenMs: number | null | undefined,
    user: JwtPayload,
  ): Promise<SubmitAnswerResponseDto> {
    const answer = await this.attemptCommandService.submitAnswer(
      attemptId,
      questionId,
      selectedOptionId,
      user,
      timeTakenMs,
    );

    return this.attemptResponseMapper.toSubmitAnswerResponse(answer);
  }

  async abandonAttempt(attemptId: string, user: JwtPayload): Promise<AbandonAttemptResponseDto> {
    const abandoned = await this.attemptCommandService.abandonAttempt(attemptId, user);

    return {
      attemptId: abandoned.attemptId,
      status: abandoned.status,
      finishedAt: abandoned.finishedAt ?? new Date().toISOString(),
      message: 'Attempt abandoned successfully',
    };
  }

  async listMyAttempts(
    user: JwtPayload,
    params: {
      limit: number;
      cursor?: string;
      status?: 'started' | 'completed' | 'abandoned';
      quizId?: string;
      categoryId?: string;
      tagId?: string;
      fromDate?: string;
      toDate?: string;
      sortBy?: AttemptListSortField;
    },
  ): Promise<AttemptListResponseDto> {
    const sortBy = params.sortBy ?? 'createdAt';
    const cursor = params.cursor ? AttemptCursorMapper.parse(params.cursor) : null;

    const rows = await this.attemptQueryService.listMyAttempts(user, {
      limit: params.limit,
      cursor,
      status: params.status,
      quizId: params.quizId,
      categoryId: params.categoryId,
      tagId: params.tagId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      sortBy,
    });

    const hasNextPage = rows.length > params.limit;
    const items = hasNextPage ? rows.slice(0, params.limit) : rows;
    const lastItem = items.at(-1);

    return {
      items: this.attemptResponseMapper.toAttemptResponses(items),
      pagination: {
        limit: params.limit,
        hasNextPage,
        nextCursor:
          hasNextPage && lastItem
            ? AttemptCursorMapper.serialize({
                sortBy,
                sortValue:
                  sortBy === 'completedAt'
                    ? lastItem.sortCompletedAt
                    : sortBy === 'score'
                      ? lastItem.sortScore
                      : lastItem.sortCreatedAt,
                attemptId: lastItem.attemptId,
              })
            : null,
      },
    };
  }

  async completeAttempt(attemptId: string, user: JwtPayload): Promise<CompleteAttemptResponseDto> {
    const result = await this.attemptCommandService.completeAttempt(attemptId, user);

    return {
      attemptId: result.attemptId,
      quizId: result.quizId,
      status: result.status,
      scorePercent: result.scorePercent,
      correctCount: result.correctCount,
      timeTakenMs: result.timeTakenMs,
      xpEarned: result.xpEarned,
      finishedAt: result.finishedAt ?? new Date().toISOString(),
    };
  }

  async getAttemptAnswers(attemptId: string, user: JwtPayload): Promise<AttemptAnswersResponseDto> {
    const { attempt, answers } = await this.attemptQueryService.getAttemptAnswers(attemptId, user);

    return this.attemptResponseMapper.toAttemptAnswersResponse(attempt.attemptId, answers);
  }

  async getAttemptAnalytics(
    attemptId: string,
    user: JwtPayload,
  ): Promise<AttemptAnalyticsResponseDto> {
    const { analyticsRow, answeredCount } = await this.attemptQueryService.getAttemptAnalytics(
      attemptId,
      user,
    );

    return this.attemptResponseMapper.toAttemptAnalyticsResponse(analyticsRow, answeredCount);
  }

  async getMyAttemptStats(user: JwtPayload): Promise<UserAttemptStatsResponseDto> {
    const stats = await this.attemptQueryService.getUserAttemptStats(user.sub);
    return this.attemptResponseMapper.toUserAttemptStatsResponse(stats);
  }

  async withdrawAnswer(
    attemptId: string,
    questionId: string,
    user: JwtPayload,
  ): Promise<{ questionId: string; withdrawnAt: string }> {
    await this.attemptCommandService.withdrawAnswer(attemptId, questionId, user);
    return { questionId, withdrawnAt: new Date().toISOString() };
  }
}
