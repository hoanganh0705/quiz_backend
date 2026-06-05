import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { hasOwn } from '@/common/utils/object.util';
import { TAG_SLUG_EMPTY_MESSAGE, TAG_SLUG_INVALID_MESSAGE } from '../tag.constants';
import {
  TAG_REPOSITORY_PORT,
  type TagRepositoryPort,
  type TagRow,
  type FollowedTagRow,
  type RankedTagRow,
} from './ports/tag-repository.port';
import { TagAlreadyActiveError, TagNotFoundError, TagRestoreInvariantError } from './errors';
import type { TagPatch } from '../types/tag.types';
import type {
  CreateTagCommand,
  ListTagsQuery,
  ListFollowedTagsQuery,
  TagRankingQuery,
  RelatedTagsQuery,
  UpdateTagCommand,
} from './types/tag-commands';

@Injectable()
export class TagDomainService {
  constructor(
    @Inject(TAG_REPOSITORY_PORT)
    private readonly tagRepository: TagRepositoryPort,
    @InjectPinoLogger(TagDomainService.name) private readonly logger: PinoLogger,
  ) {}

  private normalizeSlug(slug: string): string {
    return normalizeSlugOrThrow(slug, {
      emptyMessage: TAG_SLUG_EMPTY_MESSAGE,
      invalidMessage: TAG_SLUG_INVALID_MESSAGE,
    });
  }

  async listTags(query: ListTagsQuery): Promise<{
    items: TagRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: Pick<TagRow, 'createdAt' | 'tagId'> | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.tagRepository.findMany({ limit, cursor });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor: hasNextPage && lastItem ? lastItem : null,
    };
  }

  async getTagById(tagId: string): Promise<TagRow> {
    const tag = await this.tagRepository.findById(tagId);

    if (!tag) {
      this.logger.warn({ event: 'tag_get_by_id_not_found', tagId });
      throw new TagNotFoundError();
    }

    return tag;
  }

  async getTagBySlug(slug: string): Promise<TagRow> {
    const normalizedSlug = this.normalizeSlug(slug);
    const tag = await this.tagRepository.findBySlug(normalizedSlug);

    if (!tag) {
      this.logger.warn({ event: 'tag_get_by_slug_not_found', slug: normalizedSlug });
      throw new TagNotFoundError();
    }

    return tag;
  }

  async getRelatedTags(slug: string, query: RelatedTagsQuery): Promise<TagRow[]> {
    const normalizedSlug = this.normalizeSlug(slug);
    const relatedTags = await this.tagRepository.findRelatedBySlug({
      slug: normalizedSlug,
      limit: query.limit,
    });

    if (relatedTags.length === 0) {
      await this.getTagBySlug(normalizedSlug);
    }

    return relatedTags;
  }

  async createTag(payload: CreateTagCommand): Promise<TagRow> {
    const name = payload.name.trim();
    const slug = this.normalizeSlug(payload.slug ?? buildSlug(name));
    const nowIso = new Date().toISOString();

    let tag: TagRow;

    try {
      tag = await this.tagRepository.create({ name, slug, nowIso });
    } catch (error: unknown) {
      this.logger.error({
        event: 'tag_create_failed',
        name,
        slug,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
      });
      throw error;
    }

    this.logger.info({ event: 'tag_created', tagId: tag.tagId, slug });

    return tag;
  }

  async updateTag(tagId: string, payload: UpdateTagCommand): Promise<TagRow> {
    const patch: TagPatch = {};

    if (hasOwn(payload, 'name') && payload.name !== undefined) {
      patch.name = payload.name.trim();
    }

    if (hasOwn(payload, 'slug') && payload.slug !== undefined) {
      patch.slug = this.normalizeSlug(payload.slug);
    }

    if (Object.keys(patch).length === 0) {
      return this.getTagById(tagId);
    }

    const nowIso = new Date().toISOString();
    let updated: TagRow | null;

    try {
      updated = await this.tagRepository.update({ tagId, patch, nowIso });
    } catch (error: unknown) {
      this.logger.error({
        event: 'tag_update_failed',
        tagId,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
      });
      throw error;
    }

    if (!updated) {
      this.logger.warn({ event: 'tag_update_not_found', tagId });
      throw new TagNotFoundError();
    }

    this.logger.info({ event: 'tag_updated', tagId });

    return updated;
  }

  async deleteTag(tagId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const deleted = await this.tagRepository.softDelete(tagId, nowIso);
    if (!deleted) {
      this.logger.warn({ event: 'tag_delete_not_found', tagId });
      throw new TagNotFoundError();
    }
    this.logger.info({ event: 'tag_deleted', tagId });
  }

  async restoreTag(tagId: string): Promise<TagRow> {
    const existing = await this.tagRepository.findByIdIncludingDeleted(tagId);

    if (!existing) {
      this.logger.warn({ event: 'tag_restore_not_found', tagId });
      throw new TagNotFoundError();
    }

    if (existing.deletedAt === null) {
      this.logger.warn({ event: 'tag_restore_already_active', tagId });
      throw new TagAlreadyActiveError();
    }

    const nowIso = new Date().toISOString();

    const restored = await this.tagRepository.restore(tagId, nowIso);
    if (!restored) {
      this.logger.error({ event: 'tag_restore_invariant_violation', tagId });
      throw new TagRestoreInvariantError();
    }

    this.logger.info({ event: 'tag_restored', tagId });
    return restored;
  }

  async followTag(userId: string, tagId: string): Promise<void> {
    await this.getTagById(tagId);

    const nowIso = new Date().toISOString();
    const follow = await this.tagRepository.followTag({ userId, tagId, nowIso });

    this.logger.info({
      event: 'tag_followed',
      userId,
      tagId,
      followId: follow.followId,
    });
  }

  async unfollowTag(userId: string, tagId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.tagRepository.unfollowTag({ userId, tagId, nowIso });
    this.logger.info({ event: 'tag_unfollowed', userId, tagId });
  }

  async listFollowedTags(
    userId: string,
    query: ListFollowedTagsQuery,
  ): Promise<{
    items: FollowedTagRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { followedAt: string; followId: string } | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.tagRepository.listFollowedTags({
      userId,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor: hasNextPage && lastItem ? lastItem : null,
    };
  }

  async getPopularTags(query: TagRankingQuery): Promise<RankedTagRow[]> {
    return this.tagRepository.getPopularTags(query.limit);
  }

  async getTrendingTags(query: TagRankingQuery): Promise<RankedTagRow[]> {
    return this.tagRepository.getTrendingTags(query.limit);
  }
}
