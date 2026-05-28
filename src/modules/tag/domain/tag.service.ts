import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { hasOwn } from '@/common/utils/object.util';
import { TAG_SLUG_EMPTY_MESSAGE, TAG_SLUG_INVALID_MESSAGE } from '../tag.constants';
import {
  TAG_REPOSITORY_PORT,
  type TagRepositoryPort,
  type TagRow,
} from './ports/tag-repository.port';
import { TagNotFoundError } from './errors';
import type { TagPatch } from '../types/tag.types';
import type { CreateTagCommand, ListTagsQuery, UpdateTagCommand } from './types/tag-commands';

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

    const rows = await this.tagRepository.findMany({ limit: limit + 1, cursor });

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

  async getTagBySlug(slug: string): Promise<TagRow> {
    const normalizedSlug = this.normalizeSlug(slug);
    const tag = await this.tagRepository.findBySlug(normalizedSlug);

    if (!tag) {
      this.logger.warn({ event: 'tag_get_by_slug_not_found', slug: normalizedSlug });
      throw new TagNotFoundError();
    }

    return tag;
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
      const existing = await this.tagRepository.findById(tagId);
      if (!existing) {
        this.logger.warn({ event: 'tag_update_not_found', tagId });
        throw new TagNotFoundError();
      }
      return existing;
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
}
