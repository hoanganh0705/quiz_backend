import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '@/core/database/database.module';
import { tags } from '@/core/database/schema';
import { CreateTagDto } from './dto/request/create-tag.dto';
import { ListTagsQueryDto } from './dto/request/list-tags-query.dto';
import { UpdateTagDto } from './dto/request/update-tag.dto';
import { DeleteTagResponseDto } from './dto/response/delete-tag-response.dto';
import { TagListResponseDto } from './dto/response/tag-list-response.dto';
import { TagResponseDto } from './dto/response/tag-response.dto';
import { TagCursorPayload, TagPatch } from './types/tag.types';
import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
  isStringMatchingPattern,
} from '@/common/utils/cursor.util';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';

type TagRow = {
  tagId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

const TAG_COLUMNS = {
  tagId: tags.tagId,
  name: tags.name,
  slug: tags.slug,
  createdAt: tags.createdAt,
  updatedAt: tags.updatedAt,
};

@Injectable()
export class TagService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private readonly cursorTagIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private mapUniqueConflict(error: unknown, fallbackMessage: string): never {
    const maybePgError = error as { code?: string };

    if (maybePgError.code === '23505') {
      throw new ConflictException(fallbackMessage);
    }

    throw new InternalServerErrorException('Tag operation failed');
  }

  private decodeCursor(cursor: string): TagCursorPayload {
    const parsed = decodeBase64JsonCursor<TagCursorPayload>(cursor);

    if (
      !isIsoDateString(parsed.createdAt) ||
      !isStringMatchingPattern(parsed.tagId, this.cursorTagIdPattern)
    ) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      tagId: parsed.tagId,
    };
  }

  private encodeCursor(tag: Pick<TagRow, 'createdAt' | 'tagId'>): string {
    return encodeBase64JsonCursor({ createdAt: tag.createdAt, tagId: tag.tagId });
  }

  private toTagResponse(tag: TagRow): TagResponseDto {
    return {
      tagId: tag.tagId,
      name: tag.name,
      slug: tag.slug,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }

  private async getActiveTagById(tagId: string): Promise<TagRow> {
    const [tag] = await this.db
      .select(TAG_COLUMNS)
      .from(tags)
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)))
      .limit(1);

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag as TagRow;
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
      .select(TAG_COLUMNS)
      .from(tags)
      .where(
        cursorCondition ? and(isNull(tags.deletedAt), cursorCondition) : isNull(tags.deletedAt),
      )
      .orderBy(desc(tags.createdAt), desc(tags.tagId))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const itemRows = hasNextPage ? rows.slice(0, limit) : rows;
    const items = itemRows.map((row) => this.toTagResponse(row as TagRow));
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
    const normalizedSlug = normalizeSlugOrThrow(slug, {
      emptyMessage: 'Tag slug cannot be empty',
      invalidMessage:
        'Tag slug must be lowercase and can only contain letters, numbers, and hyphens',
    });

    const [tag] = await this.db
      .select(TAG_COLUMNS)
      .from(tags)
      .where(and(eq(tags.slug, normalizedSlug), isNull(tags.deletedAt)))
      .limit(1);

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.toTagResponse(tag as TagRow);
  }

  async createTag(payload: CreateTagDto): Promise<TagResponseDto> {
    const name = payload.name.trim();
    const slug = normalizeSlugOrThrow(payload.slug ?? buildSlug(name), {
      emptyMessage: 'Tag slug cannot be empty',
      invalidMessage:
        'Tag slug must be lowercase and can only contain letters, numbers, and hyphens',
    });

    const nowIso = new Date().toISOString();

    const [createdTag] = await this.db
      .insert(tags)
      .values({
        name,
        slug,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning(TAG_COLUMNS)
      .catch((error: unknown) => this.mapUniqueConflict(error, 'Tag name or slug already exists'));

    return this.toTagResponse(createdTag as TagRow);
  }

  async updateTagById(tagId: string, payload: UpdateTagDto): Promise<TagResponseDto> {
    const patch: TagPatch = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'name') && payload.name !== undefined) {
      patch.name = payload.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'slug') && payload.slug !== undefined) {
      patch.slug = normalizeSlugOrThrow(payload.slug, {
        emptyMessage: 'Tag slug cannot be empty',
        invalidMessage:
          'Tag slug must be lowercase and can only contain letters, numbers, and hyphens',
      });
    }

    if (Object.keys(patch).length === 0) {
      const tag = await this.getActiveTagById(tagId);
      return this.toTagResponse(tag);
    }

    const [updatedTag] = await this.db
      .update(tags)
      .set({
        ...patch,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)))
      .returning(TAG_COLUMNS)
      .catch((error: unknown) => this.mapUniqueConflict(error, 'Tag name or slug already exists'));

    if (!updatedTag) {
      throw new NotFoundException('Tag not found');
    }

    return this.toTagResponse(updatedTag as TagRow);
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
