import { Injectable } from '@nestjs/common';
import { TagDomainService } from '../domain/tag.service';
import { TagResponseMapper } from '../mappers/tag-response.mapper';
import { TagCursorMapper } from '../mappers/tag-cursor.mapper';
import { FollowedTagCursorMapper } from '../mappers/followed-tag-cursor.mapper';
import type {
  RankedTagsResponseDto,
  RankedTagResponseDto,
  RelatedTagsResponseDto,
  TagFollowMessageResponseDto,
  FollowedTagsResponseDto,
  FollowedTagItemDto,
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
import type { TagRow, FollowedTagRow, RankedTagRow } from '../domain/ports/tag-repository.port';
import { TagAnalyticsNotFoundError } from '../domain/errors';
import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { DeleteTagResponseDto, TagListResponseDto, TagResponseDto } from '../dto/response';

@Injectable()
export class TagApplicationService {
  constructor(
    private readonly tagDomainService: TagDomainService,
    private readonly quizApplicationService: QuizApplicationService,
  ) {}

  async listTags(query: ListTagsQuery): Promise<TagListResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.tagDomainService.listTags(query);

    return {
      items: items.map((item) => this.toTagResponse(item)),
      pagination: {
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

  async getTagQuizzesBySlug(
    slug: string,
    quizQuery: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    const tag = await this.tagDomainService.getTagBySlug(slug);

    return this.quizApplicationService.listQuizzes({
      ...quizQuery,
      tagId: tag.tagId,
    });
  }

  async getRelatedTags(slug: string, query: RelatedTagsQuery): Promise<RelatedTagsResponseDto> {
    const items = await this.tagDomainService.getRelatedTags(slug, query);

    return {
      items: items.map((item) => this.toTagResponse(item)),
    };
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

  async followTag(userId: string, tagId: string): Promise<TagFollowMessageResponseDto> {
    await this.tagDomainService.followTag(userId, tagId);
    return { message: 'Tag followed successfully' };
  }

  async unfollowTag(userId: string, tagId: string): Promise<TagFollowMessageResponseDto> {
    await this.tagDomainService.unfollowTag(userId, tagId);
    return { message: 'Tag unfollowed successfully' };
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
      items: items.map((item) => this.toFollowedTagItem(item)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? FollowedTagCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getPopularTags(query: TagRankingQuery): Promise<RankedTagsResponseDto> {
    const items = await this.tagDomainService.getPopularTags(query);
    return { items: items.map((item) => this.toRankedTagResponse(item)) };
  }

  async getTrendingTags(query: TagRankingQuery): Promise<RankedTagsResponseDto> {
    const items = await this.tagDomainService.getTrendingTags(query);
    return { items: items.map((item) => this.toRankedTagResponse(item)) };
  }

  async getTagAnalytics(tagId: string): Promise<TagAnalyticsResponseDto> {
    await this.tagDomainService.getTagById(tagId);

    // TODO: Integrate with QuizAnalyticsService once tag-level analytics
    // are supported. Currently QuizAnalyticsService only supports
    // getCategoryAnalytics() — tag analytics are not yet implemented.
    // When implemented, replace this stub with:
    //   const analytics = await this.quizAnalyticsService.getTagAnalytics(tagId);
    //   if (!analytics) throw new TagAnalyticsNotFoundError();
    //   return TagAnalyticsResponseMapper.toResponse(analytics);
    throw new TagAnalyticsNotFoundError();
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────────

  private toTagResponse(row: TagRow): TagResponseDto {
    return TagResponseMapper.toResponse(row);
  }

  private toFollowedTagItem(item: FollowedTagRow): FollowedTagItemDto {
    return {
      tagId: item.tagId,
      name: item.name,
      slug: item.slug,
      followedAt: item.followedAt,
    };
  }

  private toRankedTagResponse(item: RankedTagRow): RankedTagResponseDto {
    return {
      rank: item.rank,
      tagId: item.tagId,
      name: item.name,
      slug: item.slug,
      totalScore: item.totalScore,
      totalAttempts: item.totalAttempts,
    };
  }
}
