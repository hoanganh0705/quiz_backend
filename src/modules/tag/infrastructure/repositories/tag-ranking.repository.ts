import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizzes, tags, quizTags, quizStats } from '@/core/database/schema';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { TagRankingRepositoryPort } from '../../domain/ports/tag-ranking-repository.port';
import type { TagRow, RankedTagRow } from '../../domain/ports/tag-repository.types';

const TAG_COLUMNS = {
  tagId: tags.tagId,
  name: tags.name,
  slug: tags.slug,
  createdAt: tags.createdAt,
  updatedAt: tags.updatedAt,
};

@Injectable()
export class TagRankingRepository implements TagRankingRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
      .innerJoin(quizzes, eq((quizzes as { quizId: AnyPgColumn }).quizId, quizTags.quizId))
      .where(
        and(
          isNull(tags.deletedAt),
          ne(tags.slug, slug),
          isNull((quizzes as { deletedAt: AnyPgColumn }).deletedAt),
          eq((quizzes as { isHidden: AnyPgColumn }).isHidden, false),
        ),
      )
      .groupBy(tags.tagId, tags.name, tags.slug, tags.createdAt, tags.updatedAt)
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${quizTags.quizId})`), asc(tags.name))
      .limit(limit);

    return rows as TagRow[];
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
