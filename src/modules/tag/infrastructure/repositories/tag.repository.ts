import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tags } from '@/core/database/schema';
import type { TagRepositoryPort } from '../../domain/ports/tag-repository.port';
import type { TagRow, TagDeleteStatus } from '../../domain/ports/tag-repository.types';
import { TagRepositoryConstraintError } from './tag.repository.errors';

const TAG_COLUMNS = {
  tagId: tags.tagId,
  name: tags.name,
  slug: tags.slug,
  createdAt: tags.createdAt,
  updatedAt: tags.updatedAt,
};

const TAG_COLUMNS_WITH_DELETED = {
  ...TAG_COLUMNS,
  deletedAt: tags.deletedAt,
};

@Injectable()
export class TagRepository implements TagRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(tagId: string): Promise<TagRow | null> {
    const [row] = await this.db
      .select(TAG_COLUMNS)
      .from(tags)
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  async findByIdIncludingDeleted(tagId: string): Promise<TagDeleteStatus | null> {
    const [row] = await this.db
      .select(TAG_COLUMNS_WITH_DELETED)
      .from(tags)
      .where(eq(tags.tagId, tagId))
      .limit(1);

    return row ?? null;
  }

  async findBySlug(slug: string): Promise<TagRow | null> {
    const [row] = await this.db
      .select(TAG_COLUMNS)
      .from(tags)
      .where(and(eq(tags.slug, slug), isNull(tags.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  async findBySlugs(slugs: string[]): Promise<TagRow[]> {
    if (slugs.length === 0) return [];
    const rows = await this.db
      .select(TAG_COLUMNS)
      .from(tags)
      .where(and(inArray(tags.slug, slugs), isNull(tags.deletedAt)));

    return rows;
  }

  async findMany(params: {
    limit: number;
    cursor?: { createdAt: string; tagId: string } | null;
  }): Promise<TagRow[]> {
    const { limit, cursor } = params;

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

    return rows as TagRow[];
  }

  async create(params: { name: string; slug: string; nowIso: string }): Promise<TagRow> {
    try {
      const [row] = await this.db
        .insert(tags)
        .values({
          name: params.name,
          slug: params.slug,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning(TAG_COLUMNS);

      return row as TagRow;
    } catch (error: unknown) {
      const pg = error as { code?: string };
      if (pg.code === '23505') {
        throw new TagRepositoryConstraintError('slug_conflict');
      }
      throw error;
    }
  }

  async update(params: {
    tagId: string;
    patch: { name?: string; slug?: string };
    nowIso: string;
  }): Promise<TagRow | null> {
    try {
      const [row] = await this.db
        .update(tags)
        .set({ ...params.patch, updatedAt: params.nowIso })
        .where(and(eq(tags.tagId, params.tagId), isNull(tags.deletedAt)))
        .returning(TAG_COLUMNS);

      return (row as TagRow | undefined) ?? null;
    } catch (error: unknown) {
      const pg = error as { code?: string };
      if (pg.code === '23505') {
        throw new TagRepositoryConstraintError('slug_conflict');
      }
      throw error;
    }
  }

  async softDelete(tagId: string, nowIso: string): Promise<boolean> {
    const [row] = await this.db
      .update(tags)
      .set({ deletedAt: nowIso, updatedAt: nowIso })
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)))
      .returning({ tagId: tags.tagId });

    return Boolean(row);
  }

  async restore(tagId: string, nowIso: string): Promise<TagRow | null> {
    try {
      const [row] = await this.db
        .update(tags)
        .set({ deletedAt: null, updatedAt: nowIso })
        .where(and(eq(tags.tagId, tagId), sql`${tags.deletedAt} IS NOT NULL`))
        .returning(TAG_COLUMNS);

      return (row as TagRow | undefined) ?? null;
    } catch (error: unknown) {
      const pg = error as { code?: string };
      if (pg.code === '23505') {
        throw new TagRepositoryConstraintError('slug_conflict');
      }
      throw error;
    }
  }
}
