import { Inject, Injectable } from '@nestjs/common';
import { TagDomainService } from '../domain/tag.service';
import { TagResponseMapper } from '../mappers/tag-response.mapper';
import { FollowedTagResponseMapper } from '../mappers/followed-tag-response.mapper';
import { RankedTagResponseMapper } from '../mappers/ranked-tag-response.mapper';
import { TagCursorMapper } from '../mappers/tag-cursor.mapper';
import { FollowedTagCursorMapper } from '../mappers/followed-tag-cursor.mapper';
import { TagAnalyticsResponseMapper } from '../mappers/tag-analytics-response.mapper';
import {
  QUIZ_ANALYTICS_PORT,
  QUIZ_LISTING_PORT,
  type QuizAnalyticsPort,
  type QuizListingPort,
} from '@/modules/quiz/domain/analytics';
import type {
  RankedTagResponseDto,
  FollowedTagsResponseDto,
  TagAnalyticsResponseDto,
} from '../dto/response/parity-response.dto';
import type {
  CreateTagCommand,
  ListTagsQuery,
  ListFollowedTagsQuery,
  TagRankingQuery,
  RelatedTagsQuery,
  UpdateTagCommand,
} from '../domain/types/tag-commands';
import type { TagRow } from '../domain/ports/tag-repository.port';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { DeleteTagResponseDto, TagListResponseDto, TagResponseDto } from '../dto/response';
import { TagAnalyticsNotFoundError } from '../domain/errors';

@Injectable()
export class TagApplicationService {
  constructor(
    private readonly tagDomainService: TagDomainService,
    @Inject(QUIZ_LISTING_PORT)
    private readonly quizListingService: QuizListingPort,
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalyticsService: QuizAnalyticsPort,
  ) {}

  async listTags(query: ListTagsQuery): Promise<TagListResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.tagDomainService.listTags(query);

    return {
      items: items.map((item) => this.toTagResponse(item)),
      pagination: {
        kind: 'cursor' as const,
        limit,
        hasNextPage,
        nextCursor: nextCursor ? TagCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getTagBySlug(slug: string): Promise<TagResponseDto> {
    const row = await this.tagDomainService.getTagBySlug(slug);
    return this.toTagResponse(row);
  }

  /**
   * Phase 2 (S-13): batched lookup by comma-separated slugs. The
   * frontend's `useTagSlugsResolver` hook calls this to map a
   * filter-chip list into tag IDs (for the URL state) and back
   * (for chip labels).
   */
  async getTagsBySlugs(slugs: string[]): Promise<TagResponseDto[]> {
    const rows = await this.tagDomainService.getTagsBySlugs(slugs);
    return rows.map((row) => this.toTagResponse(row));
  }

  async getTagById(tagId: string): Promise<TagResponseDto> {
    const row = await this.tagDomainService.getTagById(tagId);
    return this.toTagResponse(row);
  }

  async getTagQuizzesBySlug(
    slug: string,
    quizQuery: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    const tag = await this.tagDomainService.getTagBySlug(slug);

    return this.quizListingService.listQuizzesByTag({
      tagIds: [tag.tagId],
      dto: quizQuery,
    });
  }

  async getRelatedTags(slug: string, query: RelatedTagsQuery): Promise<TagResponseDto[]> {
    const items = await this.tagDomainService.getRelatedTags(slug, query);
    return items.map((item) => this.toTagResponse(item));
  }

  async createTag(payload: CreateTagCommand): Promise<TagResponseDto> {
    const row = await this.tagDomainService.createTag(payload);
    return this.toTagResponse(row);
  }

  async updateTag(tagId: string, payload: UpdateTagCommand): Promise<TagResponseDto> {
    const row = await this.tagDomainService.updateTag(tagId, payload);
    return this.toTagResponse(row);
  }

  async deleteTag(tagId: string): Promise<DeleteTagResponseDto> {
    await this.tagDomainService.deleteTag(tagId);
    return { message: 'Tag deleted successfully' };
  }

  async restoreTag(tagId: string): Promise<TagResponseDto> {
    const row = await this.tagDomainService.restoreTag(tagId);
    return this.toTagResponse(row);
  }

  async followTag(userId: string, tagId: string): Promise<void> {
    await this.tagDomainService.followTag(userId, tagId);
  }

  async unfollowTag(userId: string, tagId: string): Promise<void> {
    await this.tagDomainService.unfollowTag(userId, tagId);
  }

  async listFollowedTags(
    userId: string,
    query: ListFollowedTagsQuery,
  ): Promise<FollowedTagsResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.tagDomainService.listFollowedTags(
      userId,
      query,
    );

    return {
      items: items.map((item) => FollowedTagResponseMapper.toItem(item)),
      pagination: {
        kind: 'cursor' as const,
        limit,
        hasNextPage,
        nextCursor: nextCursor ? FollowedTagCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getPopularTags(query: TagRankingQuery): Promise<RankedTagResponseDto[]> {
    const items = await this.tagDomainService.getPopularTags(query);
    return items.map((item) => RankedTagResponseMapper.toResponse(item));
  }

  async getTrendingTags(query: TagRankingQuery): Promise<RankedTagResponseDto[]> {
    const items = await this.tagDomainService.getTrendingTags(query);
    return items.map((item) => RankedTagResponseMapper.toResponse(item));
  }

  async getTagAnalytics(tagId: string): Promise<TagAnalyticsResponseDto> {
    await this.tagDomainService.getTagById(tagId);
    const analytics = await this.quizAnalyticsService.getTagAnalytics(tagId);

    if (!analytics) {
      throw new TagAnalyticsNotFoundError();
    }

    return TagAnalyticsResponseMapper.toResponse(analytics);
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────────

  private toTagResponse(row: TagRow): TagResponseDto {
    return TagResponseMapper.toResponse(row);
  }
}
