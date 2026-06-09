import { Injectable } from '@nestjs/common';
import { QuizAnalyticsService } from '../domain/analytics';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizQueryService } from '../domain/quiz/quiz-query.service';
import { QuizCommandService } from '../domain/quiz/quiz-command.service';
import {
  QuizResponseMapper,
  QuizQuestionResponseMapper,
  QuizStatsResponseMapper,
} from '../mappers';
import { CreatorQuizAnalyticsResponseMapper } from '../mappers/creator-quiz-analytics-response.mapper';
import { QuizCursorMapper } from '../mappers/quiz-cursor.mapper';
import { CreateQuizDto } from '../dto/request/create-quiz.dto';
import { UpdateQuizDto } from '../dto/request/update-quiz.dto';
import { FeaturedQuizzesQueryDto } from '../dto/request/featured-quizzes-query.dto';
import { RecommendedQuizzesQueryDto } from '../dto/request/recommended-quizzes-query.dto';
import { ListQuizzesQueryDto } from '../dto/request/list-quizzes-query.dto';
import type { QuizResponseDto } from '../dto/response/quiz-response.dto';
import type { QuizListResponseDto } from '../dto/response/quiz-list-response.dto';
import type { QuizStatsResponseDto } from '../dto/response/quiz-stats-response.dto';
import type {
  CreatorQuizAnalyticsDto,
  PopularQuizzesResponseDto,
  TrendingQuizzesResponseDto,
} from '../dto/response/quiz-analytics.dto';
import type { RelatedQuizzesResponseDto } from '../dto/response/related-quizzes-response.dto';
import type { DeleteQuizResponseDto } from '../dto/response/delete-quiz-response.dto';
import type { CreateQuizCommand, RelatedQuizzesQuery, UpdateQuizCommand } from '../domain/types';
import type { QuizDifficulty } from '../types/quiz.types';

@Injectable()
export class QuizApplicationService {
  constructor(
    private readonly quizQueryService: QuizQueryService,
    private readonly quizCommandService: QuizCommandService,
    private readonly quizAnalyticsService: QuizAnalyticsService,
  ) {}

  async createQuiz(user: JwtPayload, dto: CreateQuizDto): Promise<QuizResponseDto> {
    const command: CreateQuizCommand = {
      creatorId: user.sub,
      title: dto.title,
      slug: dto.slug as string,
      description: dto.description ?? null,
      requirements: dto.requirements ?? null,
      imageUrl: dto.imageUrl ?? null,
      isFeatured: dto.isFeatured ?? false,
      isHidden: dto.isHidden ?? false,
      initialVersion: dto.initialVersion,
      categoryIds: dto.categoryIds ?? [],
      tagIds: dto.tagIds ?? [],
    };
    const result = await this.quizCommandService.createQuiz(user, command);
    return QuizResponseMapper.toQuizResponse(result);
  }

  async listQuizzes(dto: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listQuizzes({
      limit,
      cursor,
      filters: {
        difficulty: dto.difficulty as QuizDifficulty,
        categoryId: dto.categoryId,
        tagId: dto.tagId,
      },
    });

    return {
      items: result.rows.map((row) => QuizResponseMapper.toQuizResponse(row)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getFeaturedQuizzes(query: FeaturedQuizzesQueryDto): Promise<RelatedQuizzesResponseDto> {
    const items = await this.quizQueryService.getFeaturedQuizzes({
      limit: query.limit ?? 10,
    });

    return {
      items: items.map((item) => QuizResponseMapper.toQuizResponse(item)),
    };
  }

  async getRecommendedQuizzes(
    userId: string,
    query: RecommendedQuizzesQueryDto,
  ): Promise<RelatedQuizzesResponseDto> {
    const items = await this.quizQueryService.getRecommendedQuizzes(userId, {
      limit: query.limit ?? 20,
    });

    return {
      items: items.map((item) => QuizResponseMapper.toQuizResponse(item)),
    };
  }

  async getQuizBySlug(slug: string): Promise<QuizResponseDto> {
    const { row, questions } = await this.quizQueryService.getQuizBySlug(slug);
    const mappedQuestions = questions
      ? QuizQuestionResponseMapper.toQuestionResponses(questions)
      : undefined;
    return QuizResponseMapper.toQuizResponse(row, mappedQuestions);
  }

  async getQuizStats(quizId: string): Promise<QuizStatsResponseDto> {
    const stats = await this.quizQueryService.getQuizStats(quizId);
    return QuizStatsResponseMapper.toResponse(stats);
  }

  async getRelatedQuizzes(
    slug: string,
    query: RelatedQuizzesQuery,
  ): Promise<RelatedQuizzesResponseDto> {
    const items = await this.quizQueryService.getRelatedQuizzes(slug, query);

    return {
      items: items.map((item) => QuizResponseMapper.toQuizResponse(item)),
    };
  }

  async listQuizzesByCreator(
    userId: string,
    dto: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listQuizzes({
      limit,
      cursor,
      filters: {
        creatorId: userId,
      },
    });

    return {
      items: result.rows.map((row) => QuizResponseMapper.toQuizResponse(row)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async listMyQuizzes(userId: string, dto: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listUserQuizzes(userId, {
      limit,
      cursor,
    });

    return {
      items: result.rows.map((row) => QuizResponseMapper.toQuizResponse(row)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async listMyDraftQuizzes(userId: string, dto: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listDraftQuizzes(userId, {
      limit,
      cursor,
    });

    return {
      items: result.rows.map((row) => QuizResponseMapper.toQuizResponse(row)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async listMyPublishedQuizzes(
    userId: string,
    dto: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = dto.cursor ? QuizCursorMapper.parse(dto.cursor) : null;

    const result = await this.quizQueryService.listPublishedQuizzes(userId, {
      limit,
      cursor,
    });

    return {
      items: result.rows.map((row) => QuizResponseMapper.toQuizResponse(row)),
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor ? QuizCursorMapper.serialize(result.nextCursor) : null,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  async getTrendingQuizzes(
    limit: number,
    categoryId?: string,
  ): Promise<TrendingQuizzesResponseDto> {
    const quizzes = await this.quizAnalyticsService.getTrendingQuizzes(limit, categoryId);

    return {
      period: 'weekly',
      quizzes: quizzes.map((q) => ({
        rank: q.rank,
        quizId: q.quizId,
        title: q.title,
        slug: q.slug,
        imageUrl: q.imageUrl,
        trendingScore: q.trendingScore,
        totalAttempts: q.totalAttempts,
        recentAttempts: q.recentAttempts,
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuizzesResponseDto> {
    const quizzes = await this.quizAnalyticsService.getPopularQuizzes(limit, categoryId);

    return {
      quizzes: quizzes.map((q) => ({
        rank: q.rank,
        quizId: q.quizId,
        title: q.title,
        slug: q.slug,
        imageUrl: q.imageUrl,
        popularityScore: q.popularityScore,
        totalAttempts: q.totalAttempts,
        averageRating: q.averageRating,
        bookmarkCount: q.bookmarkCount,
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getMyQuizAnalytics(userId: string): Promise<CreatorQuizAnalyticsDto> {
    const analytics = await this.quizQueryService.getCreatorAnalytics(userId);
    return CreatorQuizAnalyticsResponseMapper.toResponse(analytics);
  }

  async updateQuiz(quizId: string, user: JwtPayload, dto: UpdateQuizDto): Promise<QuizResponseDto> {
    const command: UpdateQuizCommand = {
      title: dto.title,
      description: dto.description,
      slug: dto.slug,
      requirements: dto.requirements,
      imageUrl: dto.imageUrl,
      isFeatured: dto.isFeatured,
      isHidden: dto.isHidden,
      categoryIds: dto.categoryIds,
      tagIds: dto.tagIds,
    };
    const result = await this.quizCommandService.updateQuiz(quizId, user, command);
    return QuizResponseMapper.toQuizResponse(result);
  }

  async deleteQuiz(quizId: string, user: JwtPayload): Promise<DeleteQuizResponseDto> {
    return this.quizCommandService.softDeleteQuizById(quizId, user);
  }
}
