import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { hasOwn } from '@/common/utils/object.util';
import { TAG_SLUG_EMPTY_MESSAGE, TAG_SLUG_INVALID_MESSAGE } from '../tag.constants';
import {
  TAG_REPOSITORY_PORT,
  TAG_FOLLOW_REPOSITORY_PORT,
  TAG_RANKING_REPOSITORY_PORT,
  type TagRepositoryPort,
  type TagFollowRepositoryPort,
  type TagRankingRepositoryPort,
  type TagRow,
  type FollowedTagRow,
  type RankedTagRow,
} from './ports';
import {
  TagAlreadyActiveError,
  TagNotFoundError,
  TagRestoreInvariantError,
  TagSlugConflictError,
} from './errors';
import type {
  CreateTagCommand,
  ListTagsQuery,
  ListFollowedTagsQuery,
  TagRankingQuery,
  RelatedTagsQuery,
  UpdateTagCommand,
} from './types/tag-commands';
import { TagRepositoryConstraintError } from '../infrastructure/repositories/tag.repository.errors';
import {
  TAG_DOMAIN_EVENT_BUS,
  type TagDomainEventBusPort,
} from './events/tag-domain-event-bus.port';
import {
  TagCreatedEvent,
  TagUpdatedEvent,
  TagDeletedEvent,
  TagRestoredEvent,
  TagFollowedEvent,
  TagUnfollowedEvent,
} from './events/tag-domain.events';
import { RedisService } from '@/core/redis/redis.service';

const RANKING_CACHE_TTL_MS = 60_000;

@Injectable()
export class TagDomainService {
  constructor(
    @Inject(TAG_REPOSITORY_PORT)
    private readonly tagRepository: TagRepositoryPort,
    @Inject(TAG_FOLLOW_REPOSITORY_PORT)
    private readonly tagFollowRepository: TagFollowRepositoryPort,
    @Inject(TAG_RANKING_REPOSITORY_PORT)
    private readonly tagRankingRepository: TagRankingRepositoryPort,
    @Inject(TAG_DOMAIN_EVENT_BUS)
    private readonly eventBus: TagDomainEventBusPort,
    private readonly cache: RedisService,
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
    const relatedTags = await this.tagRankingRepository.findRelatedBySlug({
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
      if (error instanceof TagRepositoryConstraintError && error.constraint === 'slug_conflict') {
        throw new TagSlugConflictError();
      }
      throw error;
    }

    this.logger.info({ event: 'tag_created', tagId: tag.tagId, slug });
    this.eventBus.emitTagCreated(new TagCreatedEvent(tag.tagId, name, slug, nowIso));

    return tag;
  }

  async updateTag(tagId: string, payload: UpdateTagCommand): Promise<TagRow> {
    const patch: { name?: string; slug?: string } = {};

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
      if (error instanceof TagRepositoryConstraintError && error.constraint === 'slug_conflict') {
        throw new TagSlugConflictError();
      }
      throw error;
    }

    if (!updated) {
      this.logger.warn({ event: 'tag_update_not_found', tagId });
      throw new TagNotFoundError();
    }

    this.logger.info({ event: 'tag_updated', tagId });
    this.eventBus.emitTagUpdated(new TagUpdatedEvent(tagId, nowIso));

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
    this.eventBus.emitTagDeleted(new TagDeletedEvent(tagId, nowIso));
    await this.invalidateRankingCache();
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

    let restored: TagRow | null;

    try {
      restored = await this.tagRepository.restore(tagId, nowIso);
    } catch (error: unknown) {
      if (error instanceof TagRepositoryConstraintError && error.constraint === 'slug_conflict') {
        this.logger.warn({ event: 'tag_restore_slug_conflict', tagId });
        throw new TagSlugConflictError();
      }
      throw error;
    }

    if (!restored) {
      this.logger.error({ event: 'tag_restore_invariant_violation', tagId });
      throw new TagRestoreInvariantError();
    }

    this.logger.info({ event: 'tag_restored', tagId });
    this.eventBus.emitTagRestored(new TagRestoredEvent(tagId, nowIso));
    await this.invalidateRankingCache();
    return restored;
  }

  /**
   * Follows a tag for the given user. Idempotent — calling this multiple times
   * with the same user/tag pair has no additional effect after the first call.
   *
   * The repository implements three cases:
   *   1. An active follow already exists → returns it as-is.
   *   2. A soft-deleted follow exists → restores it.
   *   3. No follow exists → creates a new one.
   *
   * Throws `TagNotFoundError` if the tag does not exist or is soft-deleted.
   */
  async followTag(userId: string, tagId: string): Promise<void> {
    await this.getTagById(tagId);

    const nowIso = new Date().toISOString();
    const follow = await this.tagFollowRepository.followTag({ userId, tagId, nowIso });

    this.logger.info({
      event: 'tag_followed',
      userId,
      tagId,
      followId: follow.followId,
    });
    this.eventBus.emitTagFollowed(new TagFollowedEvent(userId, tagId, follow.followId, nowIso));
  }

  async unfollowTag(userId: string, tagId: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const result = await this.tagFollowRepository.unfollowTag({ userId, tagId, nowIso });
    this.logger.info({ event: 'tag_unfollowed', userId, tagId, unfollowed: result.unfollowed });
    if (result.unfollowed) {
      this.eventBus.emitTagUnfollowed(new TagUnfollowedEvent(userId, tagId, nowIso));
    }
    return result.unfollowed;
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

    const rows = await this.tagFollowRepository.listFollowedTags({
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
    const { limit } = query;
    const version = await this.getRankingVersion();
    const cacheKey = `tag:ranking:popular:${limit}:v${version}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as RankedTagRow[];
    }
    const rows = await this.tagRankingRepository.getPopularTags(limit);
    await this.cache.set(cacheKey, JSON.stringify(rows), RANKING_CACHE_TTL_MS);
    return rows;
  }

  async getTrendingTags(query: TagRankingQuery): Promise<RankedTagRow[]> {
    const { limit } = query;
    const version = await this.getRankingVersion();
    const cacheKey = `tag:ranking:trending:${limit}:v${version}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as RankedTagRow[];
    }
    const rows = await this.tagRankingRepository.getTrendingTags(limit);
    await this.cache.set(cacheKey, JSON.stringify(rows), RANKING_CACHE_TTL_MS);
    return rows;
  }

  private async invalidateRankingCache(): Promise<void> {
    const key = 'tag:ranking:version';
    const current = await this.cache.get(key);
    await this.cache.set(key, String(Number(current ?? 0) + 1 || 1), 86_400_000);
  }

  private async getRankingVersion(): Promise<number> {
    const version = await this.cache.get('tag:ranking:version');
    return Number(version ?? '1');
  }
}
