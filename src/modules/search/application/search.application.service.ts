import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import type {
  GlobalSearchResult,
  SearchCommentResult,
  SearchQuizResult,
  SearchUserResult,
  SearchCategoryResult,
  SearchTagResult,
} from '../domain';

type TsQueryConfig = 'simple' | 'english';

interface SearchVectorExpression {
  sql: SQL;
}

@Injectable()
export class SearchApplicationService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async executeTypedQuery<TResult>(query: SQL): Promise<TResult[]> {
    const result = (await this.db.execute(query)) as { rows: TResult[] };
    return result.rows;
  }

  private sanitizePrefixToken(token: string): string {
    return token.replace(/[^a-z0-9]+/gi, ' ').trim();
  }

  private buildPrefixTsQuery(query: string): string {
    return query
      .split(/\s+/)
      .flatMap((token) => this.sanitizePrefixToken(token).split(/\s+/))
      .filter((token) => token.length > 0)
      .map((token) => token.toLowerCase())
      .map((token) => `${token}:*`)
      .join(' & ');
  }

  private buildSearchCondition(
    vector: SearchVectorExpression,
    config: TsQueryConfig,
    query: string,
  ): SQL {
    const prefixQuery = this.buildPrefixTsQuery(query);

    if (!prefixQuery) {
      return sql`${vector.sql} @@ websearch_to_tsquery(${config}, ${query})`;
    }

    return sql`(
      ${vector.sql} @@ websearch_to_tsquery(${config}, ${query})
      OR ${vector.sql} @@ to_tsquery(${config}, ${prefixQuery})
    )`;
  }

  private buildRankExpression(
    vector: SearchVectorExpression,
    config: TsQueryConfig,
    query: string,
  ): SQL {
    const prefixQuery = this.buildPrefixTsQuery(query);

    if (!prefixQuery) {
      return sql`ts_rank_cd(${vector.sql}, websearch_to_tsquery(${config}, ${query}))`;
    }

    return sql`greatest(
      ts_rank_cd(${vector.sql}, websearch_to_tsquery(${config}, ${query})),
      ts_rank_cd(${vector.sql}, to_tsquery(${config}, ${prefixQuery}))
    )`;
  }

  async search(rawQuery: string, limit: number): Promise<GlobalSearchResult> {
    const query = rawQuery;

    if (!query) {
      throw new BadRequestException('Search query must not be empty');
    }

    const [usersResult, quizzesResult, commentResults, categoriesResult, tagsResult] =
      await Promise.all([
        this.searchUsers(query, limit),
        this.searchQuizzes(query, limit),
        this.searchComments(query, limit),
        this.searchCategories(query, limit),
        this.searchTags(query, limit),
      ]);

    return {
      query,
      users: usersResult,
      quizzes: quizzesResult,
      commentss: commentResults,
      categories: categoriesResult,
      tags: tagsResult,
    };
  }

  private async searchUsers(query: string, limit: number): Promise<SearchUserResult[]> {
    const userSearchCondition = this.buildSearchCondition(
      { sql: sql`u.user_search_vector` },
      'simple',
      query,
    );
    const displayNameSearchCondition = this.buildSearchCondition(
      { sql: sql`to_tsvector('simple', coalesce(up.display_name, ''))` },
      'simple',
      query,
    );
    const userRank = this.buildRankExpression({ sql: sql`u.user_search_vector` }, 'simple', query);
    const displayNameRank = this.buildRankExpression(
      { sql: sql`to_tsvector('simple', coalesce(up.display_name, ''))` },
      'simple',
      query,
    );

    const rows = await this.executeTypedQuery<SearchUserResult & { rank: number }>(sql`
      SELECT
        u.user_id AS "userId",
        u.username AS "username",
        up.display_name AS "displayName",
        greatest(${userRank}, ${displayNameRank}) AS "rank"
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.user_id
      WHERE u.deleted_at IS NULL
        AND (${userSearchCondition} OR ${displayNameSearchCondition})
      ORDER BY "rank" DESC, length(u.username) ASC, u.username ASC
      LIMIT ${limit}
    `);

    return rows.map(({ userId, username, displayName }) => ({ userId, username, displayName }));
  }

  private async searchQuizzes(query: string, limit: number): Promise<SearchQuizResult[]> {
    const quizSearchCondition = this.buildSearchCondition(
      { sql: sql`q.quiz_search_vector` },
      'english',
      query,
    );
    const quizRank = this.buildRankExpression({ sql: sql`q.quiz_search_vector` }, 'english', query);
    const rows = await this.executeTypedQuery<SearchQuizResult>(sql`
      SELECT
        q.quiz_id AS "quizId",
        q.title AS "title",
        q.slug AS "slug"
      FROM quizzes q
      WHERE q.deleted_at IS NULL
        AND q.is_hidden = false
        AND ${quizSearchCondition}
      ORDER BY ${quizRank} DESC, q.title ASC
      LIMIT ${limit}
    `);

    return rows.map(({ quizId, title, slug }) => ({ quizId, title, slug }));
  }

  private async searchComments(query: string, limit: number): Promise<SearchCommentResult[]> {
    // Simple ILIKE search on comment body — no full-text search vector exists
    // on the comments table (the Q/A-era comments_threads.full_text_search
    // was tied to the now-dropped table).
    const rows = await this.executeTypedQuery<{ commentId: string; quizId: string }>(sql`
      SELECT
        c.comment_id AS "commentId",
        c.quiz_id AS "quizId"
      FROM comments c
      WHERE c.deleted_at IS NULL
        AND c.body ILIKE '%' || ${query} || '%'
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);

    return rows.map(({ commentId, quizId }) => ({ commentId, quizId }));
  }

  private async searchCategories(query: string, limit: number): Promise<SearchCategoryResult[]> {
    const categorySearchCondition = this.buildSearchCondition(
      { sql: sql`c.category_search_vector` },
      'simple',
      query,
    );
    const categoryRank = this.buildRankExpression(
      { sql: sql`c.category_search_vector` },
      'simple',
      query,
    );
    const rows = await this.executeTypedQuery<SearchCategoryResult>(sql`
      SELECT
        c.category_id AS "categoryId",
        c.name AS "name",
        c.slug AS "slug"
      FROM categories c
      WHERE c.deleted_at IS NULL
        AND ${categorySearchCondition}
      ORDER BY ${categoryRank} DESC, c.name ASC
      LIMIT ${limit}
    `);

    return rows.map(({ categoryId, name, slug }) => ({ categoryId, name, slug }));
  }

  private async searchTags(query: string, limit: number): Promise<SearchTagResult[]> {
    const tagSearchCondition = this.buildSearchCondition(
      { sql: sql`t.tag_search_vector` },
      'simple',
      query,
    );
    const tagRank = this.buildRankExpression({ sql: sql`t.tag_search_vector` }, 'simple', query);
    const rows = await this.executeTypedQuery<SearchTagResult>(sql`
      SELECT
        t.tag_id AS "tagId",
        t.name AS "name"
      FROM tags t
      WHERE t.deleted_at IS NULL
        AND ${tagSearchCondition}
      ORDER BY ${tagRank} DESC, t.name ASC
      LIMIT ${limit}
    `);

    return rows.map(({ tagId, name }) => ({ tagId, name }));
  }
}
