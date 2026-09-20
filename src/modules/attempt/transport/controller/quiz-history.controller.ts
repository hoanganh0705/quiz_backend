import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiAuth } from '@/common/swagger/swagger-decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { AttemptApplicationService } from '../../application/attempt.application.service';
import { QuizHistoryResponseDto, UserAttemptStatsResponseDto } from '../../dto/response';
import { ListMyQuizHistoryQueryDto, QuizHistoryExportQueryDto } from '../../dto/request';
import { AttemptSummaryResponseDto } from '../../dto/response/attempt-summary-response.dto';

@ApiTags('users')
@Controller('users/me/quiz-history')
export class QuizHistoryController {
  constructor(private readonly attemptApplicationService: AttemptApplicationService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'List my quiz history',
    description:
      "Returns a cursor-paginated list of the authenticated user's quiz " +
      'attempts, mapped to a presentation-friendly entry shape.',
  })
  @ApiOkResponse({
    description: 'Quiz history entries returned',
    type: QuizHistoryResponseDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async listMyQuizHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyQuizHistoryQueryDto,
  ): Promise<QuizHistoryResponseDto> {
    const result = await this.attemptApplicationService.listMyAttempts(user, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    return {
      entries: result.items.map((item) => toQuizHistoryEntry(item)),
      pagination: {
        limit: result.pagination.limit,
        nextCursor: result.pagination.nextCursor,
        hasNextPage: result.pagination.hasNextPage,
      },
    };
  }

  @Get('stats')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my quiz-history stats',
    description:
      'Returns aggregated stats for the authenticated user: total attempts, ' +
      'completed / abandoned counts, average score, total time spent, favorite ' +
      'category and tag, and the last attempt timestamp.',
  })
  @ApiOkResponse({
    description: 'Quiz history stats returned',
    type: UserAttemptStatsResponseDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getMyQuizHistoryStats(
    @CurrentUser() user: JwtPayload,
  ): Promise<UserAttemptStatsResponseDto> {
    return this.attemptApplicationService.getMyAttemptStats(user);
  }

  @Get('export')
  @ApiAuth()
  @ApiOperation({
    summary: 'Export my quiz history',
    description:
      'Streams a downloadable CSV (default) or JSON file of the authenticated ' +
      "user's quiz attempts. Honors the same `status`, `fromDate`, and `toDate` " +
      'filters as `GET /quiz-history`. The Content-Disposition header carries a ' +
      'date-stamped filename.',
  })
  @ApiOkResponse({ description: 'Quiz history file streamed' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async exportMyQuizHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: QuizHistoryExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const format: 'csv' | 'json' = query.format ?? 'csv';
    const result = await this.attemptApplicationService.listMyAttempts(user, {
      limit: 100,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    const date = new Date().toISOString().split('T')[0];
    const filename = `quiz-history-${date}.${format}`;

    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Friendly default cache: never cache exports — they reflect the
    // current state of the user's data.
    res.setHeader('Cache-Control', 'no-store');

    if (format === 'csv') {
      const csv = toCsv(result.items.map(toQuizHistoryEntry));
      return new StreamableFile(Buffer.from(csv, 'utf8'));
    }
    const json = JSON.stringify(result.items.map(toQuizHistoryEntry), null, 2);
    return new StreamableFile(Buffer.from(json, 'utf8'));
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toQuizHistoryEntry(item: AttemptSummaryResponseDto) {
  const score = item.scorePercent !== null ? Math.round(item.scorePercent) : null;
  let status: 'passed' | 'failed' | 'abandoned' | 'in_progress';
  if (item.status === 'abandoned') {
    status = 'abandoned';
  } else if (item.status === 'started') {
    status = 'in_progress';
  } else if (score === null) {
    status = 'in_progress';
  } else if (score >= 60) {
    status = 'passed';
  } else {
    status = 'failed';
  }

  return {
    id: item.attemptId,
    quizId: item.quizId,
    quizTitle: item.quizTitle,
    quizSlug: item.quizSlug,
    status,
    score,
    correctAnswers: item.correctCount,
    totalQuestions: null,
    timeTaken: null,
    xpEarned: item.xpEarned,
    completedAt: item.finishedAt ?? item.startedAt,
    difficulty: item.difficulty,
  };
}

function toCsv(entries: ReturnType<typeof toQuizHistoryEntry>[]): string {
  const header = [
    'id',
    'quizId',
    'quizTitle',
    'quizSlug',
    'status',
    'score',
    'correctAnswers',
    'totalQuestions',
    'timeTaken',
    'xpEarned',
    'completedAt',
    'difficulty',
  ];
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    // JSON-serialise objects/arrays so we don't fall back to
    // `[object Object]`. Primitives (string/number/boolean/bigint)
    // are coerced directly with `String(...)` to keep CSV cells
    // human-readable. The `String(value)` call below is intentional
    // and safe — `value` cannot be an object here because we've
    // already exhausted `typeof value === 'object' || === 'function'`
    // in the boolean above, but the `no-base-to-string` lint rule
    // does not narrow `unknown` across that branch, hence the disable.

    const raw =
      typeof value === 'object' || typeof value === 'function'
        ? (JSON.stringify(value) ?? '')
        : // eslint-disable-next-line @typescript-eslint/no-base-to-string
          String(value);
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };
  const rows = entries.map((e) =>
    header.map((h) => escape((e as unknown as Record<string, unknown>)[h])).join(','),
  );
  return [header.join(','), ...rows].join('\n');
}
