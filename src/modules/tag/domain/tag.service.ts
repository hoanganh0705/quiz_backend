import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateTagDto } from '../../dto/request/create-tag.dto';
import { UpdateTagDto } from '../../dto/request/update-tag.dto';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { hasOwn } from '@/common/utils/object.util';
import { TAG_SLUG_EMPTY_MESSAGE, TAG_SLUG_INVALID_MESSAGE } from '../../tag.constants';
import { TAG_REPOSITORY_PORT, type TagRepositoryPort, type TagRow } from './ports';
import { TagNotFoundError, TagSlugConflictError } from './errors';
import type { TagCursorPayload, TagPatch } from '../../types/tag.types';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

@Injectable()
export class TagDomainService {
  private readonly tagIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  private decodeCursor(cursor: string): TagCursorPayload {
    const parsed = decodeBase64JsonCursor<TagCursorPayload>(cursor);

    if (
      !this.isIsoDateString(parsed.createdAt) ||
      !this.isStringMatchingPattern(parsed.tagId, this.tagIdPattern)
    ) {
      throw new Error('Invalid cursor');
    }

    return { createdAt: parsed.createdAt, tagId: parsed.tagId };
  }

  private encodeCursor(tag: Pick<TagRow, 'createdAt' | 'tagId'>): string {
    return encodeBase64JsonCursor({ createdAt: tag.createdAt, tagId: tag.tagId });
  }

  private isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }

  private isStringMatchingPattern(value: unknown, pattern: RegExp): boolean {
    return typeof value === 'string' && pattern.test(value);
  }

  async listTags(query: {
    cursor?: string;
    limit?: number;
  }): Promise<{ items: TagRow[]; limit: number; hasNextPage: boolean; nextCursor: string | null }> {
    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? this.decodeCursor(cursorValue) : null;

    const rows = await this.tagRepository.findMany({ limit: limit + 1, cursor });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor: hasNextPage && lastItem ? this.encodeCursor(lastItem) : null,
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

  async createTag(payload: CreateTagDto): Promise<TagRow> {
    const name = payload.name.trim();
    const slug = this.normalizeSlug(payload.slug ?? buildSlug(name));
    const nowIso = new Date().toISOString();

    let tag: TagRow;

    try {
      tag = await this.tagRepository.create({ name, slug, nowIso });
    } catch (error: unknown) {
      const pg = error as { code?: string };
      this.logger.error({
        event: 'tag_create_failed',
        name,
        slug,
        errorCode: pg.code ?? 'UNKNOWN',
      });
      if (pg.code === '23505') {
        throw new TagSlugConflictError();
      }
      throw error;
    }

    this.logger.info({ event: 'tag_created', tagId: tag.tagId, slug });

    return tag;
  }

  async updateTag(tagId: string, payload: UpdateTagDto): Promise<TagRow> {
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
      const pg = error as { code?: string };
      this.logger.error({
        event: 'tag_update_failed',
        tagId,
        errorCode: pg.code ?? 'UNKNOWN',
      });
      if (pg.code === '23505') {
        throw new TagSlugConflictError();
      }
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
    await this.tagRepository.softDelete(tagId, nowIso);
    this.logger.info({ event: 'tag_deleted', tagId });
  }
}
