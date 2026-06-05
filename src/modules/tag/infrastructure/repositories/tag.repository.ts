import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizzes, tags, tagFollows, quizTags, quizStats } from '@/core/database/schema';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { and, desc, eq, isNull, or, sql, asc, ne } from 'drizzle-orm';
import { TagSlugConflictError } from '../../domain/errors';
import type {
  TagRepositoryPort,
  TagRow,
  TagRowWithDeleted,
  TagFollowRow,
  FollowedTagRow,
  RankedTagRow,
} from '../../domain/ports/tag-repository.port';

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

const FOLLOW_COLUMNS = {
  followId: tagFollows.followId,
  userId: tagFollows.userId,
  tagId: tagFollows.tagId,
  createdAt: tagFollows.createdAt,
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

  async findByIdIncludingDeleted(tagId: string): Promise<TagRowWithDeleted | null> {
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

  async findRelatedBySlug(params: { slug: string; limit: number }): Promise<TagRow[]> {
    const { slug, limit } = params;

    const sourceTag = this.db.$with('source_tag').as(
      this.db
        .select({ tagId: tags.tagId })
        .from(tags)
        .where(and(eq(tags.slug, slug), isNull(tags.deletedAt)))
        .limit(1),
    );

    const sourceQuizIds = this.db
      .$with('source_quiz_ids')
      .as(
        this.db
          .selectDistinct({ quizId: quizTags.quizId })
          .from(quizTags)
          .innerJoin(sourceTag, eq(quizTags.tagId, sourceTag.tagId)),
      );

    const rows = await this.db
      .with(sourceTag, sourceQuizIds)
      .select(TAG_COLUMNS)
      .from(tags)
      .innerJoin(quizTags, eq(quizTags.tagId, tags.tagId))
      .innerJoin(sourceQuizIds, eq(sourceQuizIds.quizId, quizTags.quizId))
      .where(
        and(
          isNull(tags.deletedAt),
          ne(tags.slug, slug),
          isNull((quizzes as { deletedAt: AnyPgColumn }).deletedAt),
          eq((quizzes as { isHidden: AnyPgColumn }).isHidden, false),
        ),
      )
      .innerJoin(quizzes, eq((quizzes as { quizId: AnyPgColumn }).quizId, quizTags.quizId))
      .groupBy(tags.tagId, tags.name, tags.slug, tags.createdAt, tags.updatedAt)
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${quizTags.quizId})`), asc(tags.name))
      .limit(limit);

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
        throw new TagSlugConflictError();
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
        throw new TagSlugConflictError();
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
        throw new TagSlugConflictError();
      }
      throw error;
    }
  }

  async followTag(params: {
    userId: string;
    tagId: string;
    nowIso: string;
  }): Promise<TagFollowRow> {
    const { userId, tagId, nowIso } = params;

    const [existingActiveFollow] = await this.db
      .select(FOLLOW_COLUMNS)
      .from(tagFollows)
      .where(
        and(
          eq(tagFollows.userId, userId),
          eq(tagFollows.tagId, tagId),
          isNull(tagFollows.deletedAt),
        ),
      )
      .limit(1);

    if (existingActiveFollow) {
      return existingActiveFollow as TagFollowRow;
    }

    const [existingDeletedFollow] = await this.db
      .select(FOLLOW_COLUMNS)
      .from(tagFollows)
      .where(
        and(
          eq(tagFollows.userId, userId),
          eq(tagFollows.tagId, tagId),
          sql`${tagFollows.deletedAt} IS NOT NULL`,
        ),
      )
      .limit(1);

    if (existingDeletedFollow) {
      const [restored] = await this.db
        .update(tagFollows)
        .set({ deletedAt: null })
        .where(eq(tagFollows.followId, existingDeletedFollow.followId))
        .returning(FOLLOW_COLUMNS);

      return restored as TagFollowRow;
    }

    const [newFollow] = await this.db
      .insert(tagFollows)
      .values({
        userId,
        tagId,
        createdAt: nowIso,
      })
      .returning(FOLLOW_COLUMNS);

    return newFollow as TagFollowRow;
  }

  async unfollowTag(params: { userId: string; tagId: string; nowIso: string }): Promise<void> {
    const { userId, tagId, nowIso } = params;

    await this.db
      .update(tagFollows)
      .set({ deletedAt: nowIso })
      .where(
        and(
          eq(tagFollows.userId, userId),
          eq(tagFollows.tagId, tagId),
          isNull(tagFollows.deletedAt),
        ),
      );
  }

  async listFollowedTags(params: {
    userId: string;
    limit: number;
    cursor?: { followedAt: string; followId: string } | null;
  }): Promise<FollowedTagRow[]> {
    const { userId, limit, cursor } = params;

    const cursorCondition = cursor
      ? or(
          sql`${tagFollows.createdAt} < ${cursor.followedAt}`,
          and(
            eq(tagFollows.createdAt, cursor.followedAt),
            sql`${tagFollows.followId} < ${cursor.followId}`,
          ),
        )
      : undefined;

    const baseCondition = and(
      eq(tagFollows.userId, userId),
      isNull(tagFollows.deletedAt),
      isNull(tags.deletedAt),
    );

    const whereClause = cursorCondition ? and(baseCondition, cursorCondition) : baseCondition;

    const rows = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        followId: tagFollows.followId,
        followedAt: tagFollows.createdAt,
      })
      .from(tagFollows)
      .innerJoin(tags, eq(tagFollows.tagId, tags.tagId))
      .where(whereClause)
      .orderBy(desc(tagFollows.createdAt), desc(tagFollows.followId))
      .limit(limit + 1);

    return rows as FollowedTagRow[];
  }

  async getPopularTags(limit: number): Promise<RankedTagRow[]> {
    return this.getRankedTags('popularity_score', limit);
  }

  async getTrendingTags(limit: number): Promise<RankedTagRow[]> {
    return this.getRankedTags('trending_score', limit);
  }

  private async getRankedTags(
    scoreColumn: 'popularity_score' | 'trending_score',
    limit: number,
  ): Promise<RankedTagRow[]> {
    const scoreCol =
      scoreColumn === 'popularity_score' ? quizStats.popularityScore : quizStats.trendingScore;

    const rows = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        totalScore: sql<string>`SUM(${scoreCol})`,
        totalAttempts: sql<string>`SUM(${quizStats.totalAttempts})`,
      })
      .from(tags)
      .innerJoin(quizTags, eq(quizTags.tagId, tags.tagId))
      .innerJoin(
        quizzes,
        and(
          eq((quizzes as { quizId: AnyPgColumn }).quizId, quizTags.quizId),
          isNull((quizzes as { deletedAt: AnyPgColumn }).deletedAt),
          eq((quizzes as { isHidden: AnyPgColumn }).isHidden, false),
        ),
      )
      .innerJoin(quizStats, eq(quizStats.quizId, (quizzes as { quizId: AnyPgColumn }).quizId))
      .where(isNull(tags.deletedAt))
      .groupBy(tags.tagId, tags.name, tags.slug, tags.createdAt, tags.updatedAt)
      .orderBy(
        desc(sql`SUM(${scoreCol})`),
        desc(sql`SUM(${quizStats.totalAttempts})`),
        asc(tags.tagId),
      )
      .limit(limit);

    return rows.map((row, index) => ({
      tagId: row.tagId,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      rank: index + 1,
      totalScore: row.totalScore ?? '0',
      totalAttempts: row.totalAttempts ?? '0',
    })) as RankedTagRow[];
  }
}
