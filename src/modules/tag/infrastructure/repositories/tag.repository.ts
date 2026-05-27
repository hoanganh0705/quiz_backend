import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tags } from '@/core/database/schema';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { TagRepositoryPort, TagRow } from '../../domain/ports/tag-repository.port';

const TAG_COLUMNS = {
  tagId: tags.tagId,
  name: tags.name,
  slug: tags.slug,
  createdAt: tags.createdAt,
  updatedAt: tags.updatedAt,
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

    return (row as TagRow | undefined) ?? null;
  }

  async findBySlug(slug: string): Promise<TagRow | null> {
    const [row] = await this.db
      .select(TAG_COLUMNS)
      .from(tags)
      .where(and(eq(tags.slug, slug), isNull(tags.deletedAt)))
      .limit(1);

    return (row as TagRow | undefined) ?? null;
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
  }

  async update(params: {
    tagId: string;
    patch: { name?: string; slug?: string };
    nowIso: string;
  }): Promise<TagRow | null> {
    const [row] = await this.db
      .update(tags)
      .set({ ...params.patch, updatedAt: params.nowIso })
      .where(and(eq(tags.tagId, params.tagId), isNull(tags.deletedAt)))
      .returning(TAG_COLUMNS);

    return (row as TagRow | undefined) ?? null;
  }

  async softDelete(tagId: string, nowIso: string): Promise<void> {
    await this.db
      .update(tags)
      .set({ deletedAt: nowIso, updatedAt: nowIso })
      .where(and(eq(tags.tagId, tagId), isNull(tags.deletedAt)));
  }
}
