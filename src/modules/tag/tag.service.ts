import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { tags } from '../../core/database/schema';
import { CreateTagDto } from './dto/request/create-tag.dto';
import { ListTagsQueryDto } from './dto/request/list-tags-query.dto';
import { UpdateTagDto } from './dto/request/update-tag.dto';
import { DeleteTagResponseDto } from './dto/response/delete-tag-response.dto';
import { TagListResponseDto } from './dto/response/tag-list-response.dto';
import { TagResponseDto } from './dto/response/tag-response.dto';
import { TagCursorPayload, TagPatch } from './types/tag.types';

@Injectable()
export class TagService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private static readonly SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  private readonly cursorTagIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private mapUniqueConflict(error: unknown, fallbackMessage: string): never {
    const maybePgError = error as { code?: string };

    if (maybePgError.code === '23505') {
      throw new ConflictException(fallbackMessage);
    }

    throw new InternalServerErrorException('Tag operation failed');
  }

  private buildSlug(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeSlugOrThrow(input: string): string {
    const slug = input.trim().toLowerCase();
    if (!slug) {
      throw new BadRequestException('Tag slug cannot be empty');
    }

    if (!TagService.SLUG_PATTERN.test(slug)) {
      throw new BadRequestException(
        'Tag slug must be lowercase and can only contain letters, numbers, and hyphens',
      );
    }

    return slug;
  }

  private decodeCursor(cursor: string): TagCursorPayload {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as Partial<TagCursorPayload>;

      if (
        typeof parsed.createdAt !== 'string' ||
        Number.isNaN(Date.parse(parsed.createdAt)) ||
        typeof parsed.tagId !== 'string' ||
        !this.cursorTagIdPattern.test(parsed.tagId)
      ) {
        throw new Error('Invalid cursor payload');
      }

      return {
        createdAt: parsed.createdAt,
        tagId: parsed.tagId,
      };
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private encodeCursor(tag: Pick<TagResponseDto, 'createdAt' | 'tagId'>): string {
    return Buffer.from(
      JSON.stringify({ createdAt: tag.createdAt, tagId: tag.tagId }),
      'utf8',
    ).toString('base64url');
  }

  private async getActiveTagById(tagId: string): Promise<TagResponseDto> {
    const [tag] = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(tags)
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)))
      .limit(1);

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async listActiveTags(query: ListTagsQueryDto): Promise<TagListResponseDto> {
    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? this.decodeCursor(cursorValue) : null;

    const cursorCondition = cursor
      ? or(
          sql`${tags.createdAt} < ${cursor.createdAt}`,
          and(eq(tags.createdAt, cursor.createdAt), sql`${tags.tagId} < ${cursor.tagId}`),
        )
      : undefined;

    const rows = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(tags)
      .where(
        cursorCondition ? and(isNull(tags.deletedAt), cursorCondition) : isNull(tags.deletedAt),
      )
      .orderBy(desc(tags.createdAt), desc(tags.tagId))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);
    const nextCursor = hasNextPage && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      items,
      pagination: {
        limit,
        nextCursor,
        hasNextPage,
      },
    };
  }

  async getActiveTagBySlug(slug: string): Promise<TagResponseDto> {
    const normalizedSlug = this.normalizeSlugOrThrow(slug);

    const [tag] = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(tags)
      .where(and(eq(tags.slug, normalizedSlug), isNull(tags.deletedAt)))
      .limit(1);

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async createTag(payload: CreateTagDto): Promise<TagResponseDto> {
    const name = payload.name.trim();
    const slug = payload.slug
      ? this.normalizeSlugOrThrow(payload.slug)
      : this.normalizeSlugOrThrow(this.buildSlug(name));

    const nowIso = new Date().toISOString();

    const [createdTag] = await this.db
      .insert(tags)
      .values({
        name,
        slug,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .catch((error: unknown) => this.mapUniqueConflict(error, 'Tag name or slug already exists'));

    return createdTag;
  }

  async updateTagById(tagId: string, payload: UpdateTagDto): Promise<TagResponseDto> {
    const existingTag = await this.getActiveTagById(tagId);

    const patch: TagPatch = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'name') && payload.name !== undefined) {
      patch.name = payload.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'slug') && payload.slug !== undefined) {
      patch.slug = this.normalizeSlugOrThrow(payload.slug);
    }

    if (Object.keys(patch).length === 0) {
      return existingTag;
    }

    const isNameUnchanged = patch.name === undefined || patch.name === existingTag.name;
    const isSlugUnchanged = patch.slug === undefined || patch.slug === existingTag.slug;

    if (isNameUnchanged && isSlugUnchanged) {
      return existingTag;
    }

    await this.db
      .update(tags)
      .set({
        ...patch,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)))
      .catch((error: unknown) => this.mapUniqueConflict(error, 'Tag name or slug already exists'));

    return this.getActiveTagById(tagId);
  }

  async softDeleteTagById(tagId: string): Promise<DeleteTagResponseDto> {
    const nowIso = new Date().toISOString();

    await this.db
      .update(tags)
      .set({
        deletedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)));

    return {
      message: 'Tag deleted successfully',
    };
  }
}
