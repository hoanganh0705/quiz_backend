import { eq, isNull, sql } from 'drizzle-orm';
import type { SeedTx } from '@/commands/seed/infrastructure';
import {
  badges,
  categories,
  quizzes,
  quizVersions, 
  tags,
  users,
} from '@/core/database/schema';

export class SeedLookup {
  constructor(private readonly tx: SeedTx) {}

  async userIdByUsername(username: string): Promise<string> {
    const [row] = await this.tx
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!row) throw new Error(`SeedLookup: user not found for username="${username}"`);
    return row.userId;
  }

  async categoryIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ categoryId: categories.categoryId })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    return row?.categoryId ?? null;
  }

  async tagIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ tagId: tags.tagId })
      .from(tags)
      .where(eq(tags.slug, slug))
      .limit(1);

    return row?.tagId ?? null;
  }

  async badgeIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ badgeId: badges.badgeId })
      .from(badges)
      .where(eq(badges.slug, slug))
      .limit(1);

    return row?.badgeId ?? null;
  }

  async quizIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ quizId: quizzes.quizId })
      .from(quizzes)
      .where(eq(quizzes.slug, slug))
      .limit(1);

    return row?.quizId ?? null;
  }

  async quizVersionIdBySlugAndNumber(slug: string, versionNumber: number): Promise<string | null> {
    const [row] = await this.tx
      .select({ quizVersionId: quizVersions.quizVersionId })
      .from(quizVersions)
      .innerJoin(quizzes, eq(quizVersions.quizId, quizzes.quizId))
      .where(
        sql`${quizzes.slug} = ${slug} AND ${quizVersions.versionNumber} = ${versionNumber}`,
      )
      .limit(1);

    return row?.quizVersionId ?? null;
  }

  async latestVersionIdByQuizSlug(slug: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ quizVersionId: quizVersions.quizVersionId })
      .from(quizVersions)
      .innerJoin(quizzes, eq(quizVersions.quizId, quizzes.quizId))
      .where(eq(quizzes.slug, slug))
      .orderBy(sql`${quizVersions.versionNumber} DESC`)
      .limit(1);

    return row?.quizVersionId ?? null;
  }

  async publishedVersionIdByQuizSlug(slug: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ quizVersionId: quizzes.publishedVersionId })
      .from(quizzes)
      .where(eq(quizzes.slug, slug))
      .limit(1);

    return row?.quizVersionId ?? null;
  }
}
