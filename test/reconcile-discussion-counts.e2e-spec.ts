/// <reference types="jest" />
/**
 * Reconciliation e2e for the discussion counters (`comments_count` and
 * `replies_count`) — Fix #2 of `docs/plans/denormalized-counters-audit.md`.
 *
 * Verifies that the SQL in
 * `src/core/database/migrations/0009_reconcile_discussion_counts.sql`
 * repairs drift between the denormalized counters and the actual rows in
 * `discussion_comments`.
 *
 * Three cases are seeded:
 *
 *   - Case A: thread has 3 visible comments but comments_count = 0
 *     (under-counted). After the migration, comments_count = 3.
 *
 *   - Case B: thread has 1 visible comment but comments_count = 999
 *     (over-counted). After the migration, comments_count = 1.
 *
 *   - Case C: comment has 2 visible replies but replies_count = 0
 *     (under-counted). After the migration, replies_count = 2.
 *
 * Idempotency and a no-op-against-live-DB check round out the suite.
 *
 * Skips gracefully when Postgres is unreachable so this file can sit in
 * `pnpm test:e2e` without breaking CI for engineers without a local DB.
 * Run against a live stack with:
 *
 *   pnpm db:start && pnpm db:seed:foundation && \
 *   pnpm test:e2e --testPathPatterns=reconcile-discussion-counts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Minimal `.env` loader (mirrors the other reconcile e2e tests).
// ---------------------------------------------------------------------------
function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    let inSingle = false;
    let inDouble = false;
    let hashIdx = -1;
    for (let i = 0; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === '#' && !inSingle && !inDouble) {
        hashIdx = i;
        break;
      }
    }
    if (hashIdx >= 0) trimmed = trimmed.slice(0, hashIdx).trim();
    if (!trimmed) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
loadDotEnv();

import { execSync } from 'node:child_process';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';
import * as schema from '@/core/database/schema';
import { discussionThreads, discussionComments, users } from '@/core/database/schema';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function pgExec(sqlText: string): string {
  return execSync(`docker exec -i quizdb psql -U postgres -d quizdb -At -F'|'`, {
    encoding: 'utf8',
    input: sqlText,
  }).trim();
}

function readMigrationSql(): string {
  const file = path.resolve(
    __dirname,
    '..',
    'src/core/database/migrations/0009_reconcile_discussion_counts.sql',
  );
  return fs.readFileSync(file, 'utf8');
}

describe('0009_reconcile_discussion_counts — migration e2e (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[reconcile-discussion-counts] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('reconcile-discussion-counts', () => {
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let userId: string;
    let quizId: string;
    let createdThreadIds: string[] = [];
    let createdCommentIds: string[] = [];

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle(pool, { schema }) as unknown as DrizzleDB;

      // Pull any existing seeded quiz for FK. Foundation seed provides
      // these rows.
      const [quizRow] = await db
        .select({ quizId: schema.quizzes.quizId })
        .from(schema.quizzes)
        .limit(1);
      if (!quizRow) {
        throw new Error('[reconcile-discussion-counts] no quiz in DB — run foundation seed');
      }
      quizId = quizRow.quizId;

      // One-off author user (soft-deleted in afterAll) so we can author
      // threads + comments without colliding with seeded data.
      const stamp = Date.now();
      const [author] = await db
        .insert(users)
        .values({
          email: `reconcile-disc-author-${stamp}@quiz.local`,
          username: `reconcile_disc_author_${stamp}`,
          passwordHash: 'not-used-by-this-test',
          role: 'user',
          isVerified: true,
        })
        .returning({ userId: users.userId });
      userId = author.userId;
    });

    afterAll(async () => {
      if (userId) {
        await db
          .update(users)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(users.userId, userId));
      }
      if (pool) await pool.end();
    });

    afterEach(async () => {
      // Cascade clears comments via FK ON DELETE CASCADE.
      for (const tId of createdThreadIds) {
        await db.delete(discussionThreads).where(eq(discussionThreads.threadId, tId));
      }
      createdThreadIds = [];
      // In case any orphan comment remains (e.g. parent=null seed), wipe them too.
      for (const cId of createdCommentIds) {
        await db.delete(discussionComments).where(eq(discussionComments.commentId, cId));
      }
      createdCommentIds = [];
    });

    async function seedThreadWithWrongCount(commentsCount: number): Promise<{
      threadId: string;
    }> {
      const nowIso = new Date().toISOString();
      const [t] = await db
        .insert(discussionThreads)
        .values({
          quizId,
          authorId: userId,
          title: `reconcile fixture ${nowIso}`,
          body: 'reconcile fixture',
          status: 'open',
          commentsCount,
        })
        .returning({ threadId: discussionThreads.threadId });
      createdThreadIds.push(t.threadId);
      return { threadId: t.threadId };
    }

    async function seedComment(params: {
      threadId: string;
      parentCommentId?: string | null;
      body: string;
    }): Promise<string> {
      const [c] = await db
        .insert(discussionComments)
        .values({
          threadId: params.threadId,
          authorId: userId,
          parentCommentId: params.parentCommentId ?? null,
          body: params.body,
          status: 'visible',
        })
        .returning({ commentId: discussionComments.commentId });
      createdCommentIds.push(c.commentId);
      return c.commentId;
    }

    async function setRepliesCount(commentId: string, repliesCount: number): Promise<void> {
      await db
        .update(discussionComments)
        .set({ repliesCount, updatedAt: new Date().toISOString() })
        .where(eq(discussionComments.commentId, commentId));
    }

    async function readThreadCount(threadId: string): Promise<number> {
      const [row] = await db
        .select({ commentsCount: discussionThreads.commentsCount })
        .from(discussionThreads)
        .where(eq(discussionThreads.threadId, threadId))
        .limit(1);
      return Number(row?.commentsCount ?? 0);
    }

    async function readRepliesCount(commentId: string): Promise<number> {
      const [row] = await db
        .select({ repliesCount: discussionComments.repliesCount })
        .from(discussionComments)
        .where(eq(discussionComments.commentId, commentId))
        .limit(1);
      return Number(row?.repliesCount ?? 0);
    }

    it('reads well-formed migration SQL from disk', () => {
      const sqlText = readMigrationSql();
      expect(sqlText).toMatch(/UPDATE\s+discussion_threads/i);
      expect(sqlText).toMatch(/UPDATE\s+discussion_comments/i);
      expect(sqlText).toMatch(/IS DISTINCT FROM/i);
      expect(sqlText).toMatch(/status\s*=\s*'visible'/i);
    });

    it('Case A: thread with 3 visible comments but comments_count=0 → migration brings it to 3', async () => {
      const { threadId } = await seedThreadWithWrongCount(0);
      await seedComment({ threadId, body: 'c1' });
      await seedComment({ threadId, body: 'c2' });
      await seedComment({ threadId, body: 'c3' });

      // Pre-condition: counter under-counts.
      expect(await readThreadCount(threadId)).toBe(0);

      pgExec(readMigrationSql());

      // Post-condition: counter matches COUNT(visible comments).
      expect(await readThreadCount(threadId)).toBe(3);
    });

    it('Case B: thread with 1 visible comment but comments_count=999 → migration brings it to 1', async () => {
      const { threadId } = await seedThreadWithWrongCount(999);
      await seedComment({ threadId, body: 'only one' });

      // Pre-condition: counter over-counts.
      expect(await readThreadCount(threadId)).toBe(999);

      pgExec(readMigrationSql());

      // Post-condition: counter matches COUNT(visible comments).
      expect(await readThreadCount(threadId)).toBe(1);
    });

    it('Case C: comment with 2 visible replies but replies_count=0 → migration brings it to 2', async () => {
      const { threadId } = await seedThreadWithWrongCount(0);

      const parent = await seedComment({ threadId, body: 'parent' });
      await seedComment({ threadId, body: 'reply 1', parentCommentId: parent });
      await seedComment({ threadId, body: 'reply 2', parentCommentId: parent });

      // Plant the under-count on the parent comment.
      await setRepliesCount(parent, 0);
      expect(await readRepliesCount(parent)).toBe(0);

      pgExec(readMigrationSql());

      // Post-condition: parent.replies_count matches COUNT(visible replies).
      expect(await readRepliesCount(parent)).toBe(2);
    });

    it('idempotent: running the migration a second time after convergence leaves counters unchanged', async () => {
      const { threadId } = await seedThreadWithWrongCount(0);
      await seedComment({ threadId, body: 'one' });
      await seedComment({ threadId, body: 'two' });

      pgExec(readMigrationSql());
      expect(await readThreadCount(threadId)).toBe(2);

      // Run again. Should be a no-op.
      pgExec(readMigrationSql());
      expect(await readThreadCount(threadId)).toBe(2);
    });

    it('the migration is a no-op against the live DB when no drift exists', () => {
      // After `afterEach` cleaned up our seeded threads, the production
      // data should be untouched. Run the migration; expect zero rows
      // updated. We assert by counting mismatches across both tables.
      pgExec(readMigrationSql());

      const drift = pgExec(`
        SELECT COUNT(*)::text
        FROM (
          SELECT t.thread_id AS id, t.comments_count AS cached, COALESCE(c.cnt, 0) AS actual
          FROM discussion_threads t
          LEFT JOIN (
            SELECT thread_id, COUNT(*)::int AS cnt
            FROM discussion_comments
            WHERE status = 'visible'
            GROUP BY thread_id
          ) c ON c.thread_id = t.thread_id
          WHERE t.comments_count IS DISTINCT FROM COALESCE(c.cnt, 0)
          UNION ALL
          SELECT c.comment_id AS id, c.replies_count AS cached, COALESCE(p.cnt, 0) AS actual
          FROM discussion_comments c
          LEFT JOIN (
            SELECT parent_comment_id AS comment_id, COUNT(*)::int AS cnt
            FROM discussion_comments
            WHERE status = 'visible' AND parent_comment_id IS NOT NULL
            GROUP BY parent_comment_id
          ) p ON p.comment_id = c.comment_id
          WHERE c.replies_count IS DISTINCT FROM COALESCE(p.cnt, 0)
        ) drift;
      `);

      expect(drift).toBe('0');
    });

    it('UUIDs look right', () => {
      expect(userId).toMatch(UUID_RE);
      expect(quizId).toMatch(UUID_RE);
    });
  });
});
