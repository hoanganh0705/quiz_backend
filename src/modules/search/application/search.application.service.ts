import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userProfiles, users } from '@/core/database/schema';
import type {
  GlobalSearchResult,
  SearchDiscussionResult,
  SearchQuizResult,
  SearchUserResult,
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

    const [usersResult, quizzesResult, discussionsResult] = await Promise.all([
      this.searchUsers(query, limit),
      this.searchQuizzes(query, limit),
      this.searchDiscussions(query, limit),
    ]);

    return {
      query,
      users: usersResult,
      quizzes: quizzesResult,
      discussions: discussionsResult,
    };
  }

  private async searchUsers(query: string, limit: number): Promise<SearchUserResult[]> {
    const userSearchCondition = this.buildSearchCondition(
      { sql: sql`users.user_search_vector` },
      'simple',
      query,
    );
    const displayNameSearchCondition = this.buildSearchCondition(
      { sql: sql`to_tsvector('simple', coalesce(up.display_name, ''))` },
      'simple',
      query,
    );
    const userRank = this.buildRankExpression(
      { sql: sql`users.user_search_vector` },
      'simple',
      query,
    );
    const displayNameRank = this.buildRankExpression(
      { sql: sql`to_tsvector('simple', coalesce(up.display_name, ''))` },
      'simple',
      query,
    );

    const rows = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        rank: sql<number>`greatest(${userRank}, ${displayNameRank})`,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
      .where(and(isNull(users.deletedAt), or(userSearchCondition, displayNameSearchCondition)))
      .orderBy(sql`rank DESC`, sql`length(${users.username}) ASC`, users.username)
      .limit(limit);

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

  private async searchDiscussions(query: string, limit: number): Promise<SearchDiscussionResult[]> {
    const discussionSearchCondition = this.buildSearchCondition(
      { sql: sql`dt.discussion_search_vector` },
      'english',
      query,
    );
    const discussionRank = this.buildRankExpression(
      { sql: sql`dt.discussion_search_vector` },
      'english',
      query,
    );
    const rows = await this.executeTypedQuery<SearchDiscussionResult>(sql`
      SELECT
        dt.thread_id AS "threadId",
        dt.title AS "title"
      FROM discussion_threads dt
      WHERE dt.deleted_at IS NULL
        AND ${discussionSearchCondition}
      ORDER BY ${discussionRank} DESC, dt.created_at DESC
      LIMIT ${limit}
    `);

    return rows.map(({ threadId, title }) => ({ threadId, title }));
  }
}
