import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tags, tagFollows } from '@/core/database/schema';
import type { TagFollowRepositoryPort } from '../../domain/ports/tag-follow-repository.port';
import type {
  FollowResult,
  TagUnfollowResult,
  FollowedTagRow,
} from '../../domain/ports/tag-repository.types';

@Injectable()
export class TagFollowRepository implements TagFollowRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async followTag(params: {
    userId: string;
    tagId: string;
    nowIso: string;
  }): Promise<FollowResult> {
    const { userId, tagId, nowIso } = params;

    const [existingActiveFollow] = await this.db
      .select({ followId: tagFollows.followId })
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
      return existingActiveFollow;
    }

    const [existingDeletedFollow] = await this.db
      .select({ followId: tagFollows.followId })
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
        .returning({ followId: tagFollows.followId });

      return restored;
    }

    const [newFollow] = await this.db
      .insert(tagFollows)
      .values({
        userId,
        tagId,
        createdAt: nowIso,
      })
      .returning({ followId: tagFollows.followId });

    return newFollow;
  }

  async unfollowTag(params: {
    userId: string;
    tagId: string;
    nowIso: string;
  }): Promise<TagUnfollowResult> {
    const { userId, tagId, nowIso } = params;

    const [row] = await this.db
      .update(tagFollows)
      .set({ deletedAt: nowIso })
      .where(
        and(
          eq(tagFollows.userId, userId),
          eq(tagFollows.tagId, tagId),
          isNull(tagFollows.deletedAt),
        ),
      )
      .returning({ followId: tagFollows.followId });

    return { unfollowed: Boolean(row) };
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
}
