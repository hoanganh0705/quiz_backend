import { eq, sql } from 'drizzle-orm';
import { db, type SeedContext, type SeedTx } from '../infrastructure';
import type {
  QuizSeed,
  QuizVersionSeed,
  QuizQuestionSeed,
  SeedSummary,
} from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  quizzes,
  quizVersions,
  quizQuestions,
  quizAnswerOptions,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

// ─── Quiz seed data ───────────────────────────────────────────────────────────
// Each quiz has deterministic slugs so re-runs are stable.
// Published quizzes must have ≥5 questions (MIN_QUESTIONS_TO_PUBLISH).

const QUIZ_SEEDS: QuizSeed[] = [
  // ── Published: easy quiz, fully attemptable ───────────────────────────────
  {
    slug: 'javascript-fundamentals',
    title: 'JavaScript Fundamentals',
    description: 'Test your knowledge of core JavaScript concepts.',
    creatorUsername: 'content_author',
    isFeatured: true,
    isHidden: false,
    versions: [
      {
        versionNumber: 1,
        status: 'published',
        difficulty: 'easy',
        durationMs: 600_000,
        passingScorePercent: 60,
        rewardXp: 100,
        questions: [
          {
            position: 1,
            questionText: 'Which keyword is used to declare a variable in JavaScript?',
            answerOptions: [
              { position: 1, value: 'var', isCorrect: false },
              { position: 2, value: 'let', isCorrect: true },
              { position: 3, value: 'const', isCorrect: false },
              { position: 4, value: 'Both let and const', isCorrect: false },
            ],
          },
          {
            position: 2,
            questionText: 'What will console.log(typeof null) output?',
            answerOptions: [
              { position: 1, value: '"null"', isCorrect: false },
              { position: 2, value: '"undefined"', isCorrect: false },
              { position: 3, value: '"object"', isCorrect: true },
              { position: 4, value: '"number"', isCorrect: false },
            ],
          },
          {
            position: 3,
            questionText: 'Which method adds an element to the end of an array?',
            answerOptions: [
              { position: 1, value: 'unshift()', isCorrect: false },
              { position: 2, value: 'push()', isCorrect: true },
              { position: 3, value: 'pop()', isCorrect: false },
              { position: 4, value: 'shift()', isCorrect: false },
            ],
          },
          {
            position: 4,
            questionText: 'What does the === operator check for?',
            answerOptions: [
              { position: 1, value: 'Value equality only', isCorrect: false },
              { position: 2, value: 'Reference equality only', isCorrect: false },
              { position: 3, value: 'Value and type equality', isCorrect: true },
              { position: 4, value: 'None of the above', isCorrect: false },
            ],
          },
          {
            position: 5,
            questionText: 'Which built-in method combines two arrays?',
            answerOptions: [
              { position: 1, value: 'merge()', isCorrect: false },
              { position: 2, value: 'concat()', isCorrect: true },
              { position: 3, value: 'combine()', isCorrect: false },
              { position: 4, value: 'join()', isCorrect: false },
            ],
          },
        ],
      },
    ],
  },

  // ── Published: medium quiz with multiple versions ──────────────────────────
  {
    slug: 'system-design-v2',
    title: 'System Design Essentials',
    description: 'Design scalable distributed systems.',
    creatorUsername: 'content_author',
    isFeatured: false,
    isHidden: false,
    versions: [
      // Version 1: archived (immutable, no longer available)
      {
        versionNumber: 1,
        status: 'archived',
        difficulty: 'medium',
        durationMs: 900_000,
        passingScorePercent: 70,
        rewardXp: 200,
        questions: [
          {
            position: 1,
            questionText: 'What does CAP theorem stand for?',
            answerOptions: [
              { position: 1, value: 'Consistency, Availability, Partition tolerance', isCorrect: true },
              { position: 2, value: 'Consistency, Async, Performance', isCorrect: false },
              { position: 3, value: 'Cache, API, Protocol', isCorrect: false },
              { position: 4, value: 'Compute, Allocate, Process', isCorrect: false },
            ],
          },
          {
            position: 2,
            questionText: 'Which caching strategy writes data to the cache and the database simultaneously?',
            answerOptions: [
              { position: 1, value: 'Cache-aside', isCorrect: false },
              { position: 2, value: 'Write-through', isCorrect: true },
              { position: 3, value: 'Write-behind', isCorrect: false },
              { position: 4, value: 'Refresh-ahead', isCorrect: false },
            ],
          },
          {
            position: 3,
            questionText: 'What is the primary purpose of a message queue in a distributed system?',
            answerOptions: [
              { position: 1, value: 'Load balancing', isCorrect: false },
              { position: 2, value: 'Decoupling producers and consumers', isCorrect: true },
              { position: 3, value: 'Data replication', isCorrect: false },
              { position: 4, value: 'Authentication', isCorrect: false },
            ],
          },
          {
            position: 4,
            questionText: 'Which database type is best suited for hierarchical data?',
            answerOptions: [
              { position: 1, value: 'Relational (SQL)', isCorrect: false },
              { position: 2, value: 'Document store', isCorrect: false },
              { position: 3, value: 'Key-value store', isCorrect: false },
              { position: 4, value: 'Graph database', isCorrect: true },
            ],
          },
          {
            position: 5,
            questionText: 'What does horizontal scaling mean?',
            answerOptions: [
              { position: 1, value: 'Adding more CPU to existing machines', isCorrect: false },
              { position: 2, value: 'Adding more machines to the pool', isCorrect: true },
              { position: 3, value: 'Increasing memory allocation', isCorrect: false },
              { position: 4, value: 'Upgrading disk storage', isCorrect: false },
            ],
          },
        ],
      },
      // Version 2: published (current active version)
      {
        versionNumber: 2,
        status: 'published',
        difficulty: 'medium',
        durationMs: 1_200_000,
        passingScorePercent: 65,
        rewardXp: 250,
        questions: [
          {
            position: 1,
            questionText: 'In CAP theorem, during a network partition, you must choose between:',
            answerOptions: [
              { position: 1, value: 'Consistency and Availability', isCorrect: true },
              { position: 2, value: 'Consistency and Durability', isCorrect: false },
              { position: 3, value: 'Availability and Durability', isCorrect: false },
              { position: 4, value: 'Consistency and Performance', isCorrect: false },
            ],
          },
          {
            position: 2,
            questionText: 'Which load balancing algorithm routes requests to the server with the fewest active connections?',
            answerOptions: [
              { position: 1, value: 'Round Robin', isCorrect: false },
              { position: 2, value: 'Least Connections', isCorrect: true },
              { position: 3, value: 'IP Hash', isCorrect: false },
              { position: 4, value: 'Random', isCorrect: false },
            ],
          },
          {
            position: 3,
            questionText: 'What is eventual consistency?',
            answerOptions: [
              { position: 1, value: 'Data is always immediately consistent', isCorrect: false },
              { position: 2, value: 'Data will become consistent over time without updates', isCorrect: true },
              { position: 3, value: 'Data is never consistent', isCorrect: false },
              { position: 4, value: 'Data is consistent only during reads', isCorrect: false },
            ],
          },
          {
            position: 4,
            questionText: 'Which pattern is used to handle repeated requests for the same data?',
            answerOptions: [
              { position: 1, value: 'Circuit Breaker', isCorrect: false },
              { position: 2, value: 'Bulkhead', isCorrect: false },
              { position: 3, value: 'Cache-Aside', isCorrect: true },
              { position: 4, value: 'Saga', isCorrect: false },
            ],
          },
          {
            position: 5,
            questionText: 'What does a reverse proxy provide that a forward proxy does not?',
            answerOptions: [
              { position: 1, value: 'Caching responses from servers', isCorrect: true },
              { position: 2, value: 'Hiding client IP addresses from the internet', isCorrect: false },
              { position: 3, value: 'Bypassing geo-restrictions', isCorrect: false },
              { position: 4, value: 'Compressing outgoing requests', isCorrect: false },
            ],
          },
          {
            position: 6,
            questionText: 'Which consistency model guarantees that a read always returns the most recent write?',
            answerOptions: [
              { position: 1, value: 'Causal consistency', isCorrect: false },
              { position: 2, value: 'Eventual consistency', isCorrect: false },
              { position: 3, value: 'Strong consistency', isCorrect: true },
              { position: 4, value: 'Read-your-writes consistency', isCorrect: false },
            ],
          },
        ],
      },
      // Version 3: draft (work in progress)
      {
        versionNumber: 3,
        status: 'draft',
        difficulty: 'hard',
        durationMs: 1_500_000,
        passingScorePercent: 70,
        rewardXp: 300,
        questions: [
          // Only 3 questions — below MIN_QUESTIONS_TO_PUBLISH threshold.
          // This demonstrates the "insufficient questions" edge case.
          {
            position: 1,
            questionText: 'What is a benefit of the CQRS pattern?',
            answerOptions: [
              { position: 1, value: 'Single database schema', isCorrect: false },
              { position: 2, value: 'Separation of read and write models', isCorrect: true },
              { position: 3, value: 'Elimination of indexes', isCorrect: false },
              { position: 4, value: 'Automatic data replication', isCorrect: false },
            ],
          },
          {
            position: 2,
            questionText: 'Which technique reduces database load by serving pre-computed query results?',
            answerOptions: [
              { position: 1, value: 'Sharding', isCorrect: false },
              { position: 2, value: 'Materialized views', isCorrect: true },
              { position: 3, value: 'Vertical partitioning', isCorrect: false },
              { position: 4, value: 'Denormalization only', isCorrect: false },
            ],
          },
          {
            position: 3,
            questionText: 'What is the primary advantage of a content delivery network (CDN)?',
            answerOptions: [
              { position: 1, value: 'Database replication', isCorrect: false },
              { position: 2, value: 'Reduced latency by serving from edge locations', isCorrect: true },
              { position: 3, value: 'Load balancing between regions', isCorrect: false },
              { position: 4, value: 'Automatic failover', isCorrect: false },
            ],
          },
        ],
      },
    ],
  },

  // ── Draft-only quiz: has only draft versions, cannot be published yet ─────
  {
    slug: 'data-structures-primer',
    title: 'Data Structures Primer',
    description: 'Introduction to fundamental data structures.',
    creatorUsername: 'content_author',
    isFeatured: false,
    isHidden: false,
    versions: [
      {
        versionNumber: 1,
        status: 'draft',
        difficulty: 'easy',
        durationMs: 600_000,
        passingScorePercent: 60,
        rewardXp: 100,
        questions: [
          {
            position: 1,
            questionText: 'What is the time complexity of accessing an element in an array by index?',
            answerOptions: [
              { position: 1, value: 'O(n)', isCorrect: false },
              { position: 2, value: 'O(log n)', isCorrect: false },
              { position: 3, value: 'O(1)', isCorrect: true },
              { position: 4, value: 'O(n log n)', isCorrect: false },
            ],
          },
          {
            position: 2,
            questionText: 'Which data structure uses LIFO (Last In, First Out) ordering?',
            answerOptions: [
              { position: 1, value: 'Queue', isCorrect: false },
              { position: 2, value: 'Stack', isCorrect: true },
              { position: 3, value: 'Linked List', isCorrect: false },
              { position: 4, value: 'Heap', isCorrect: false },
            ],
          },
          {
            position: 3,
            questionText: 'What is the worst-case time complexity of searching in a binary search tree?',
            answerOptions: [
              { position: 1, value: 'O(1)', isCorrect: false },
              { position: 2, value: 'O(log n)', isCorrect: false },
              { position: 3, value: 'O(n)', isCorrect: true },
              { position: 4, value: 'O(n^2)', isCorrect: false },
            ],
          },
          {
            position: 4,
            questionText: 'Which hash collision resolution technique chains entries in linked lists?',
            answerOptions: [
              { position: 1, value: 'Linear probing', isCorrect: false },
              { position: 2, value: 'Quadratic probing', isCorrect: false },
              { position: 3, value: 'Separate chaining', isCorrect: true },
              { position: 4, value: 'Robin Hood hashing', isCorrect: false },
            ],
          },
        ],
      },
    ],
  },

  // ── Published hard quiz: used in tournaments and leaderboard scenarios ────
  {
    slug: 'algorithms-advanced',
    title: 'Advanced Algorithms',
    description: 'Deep dive into complex algorithmic problems.',
    creatorUsername: 'admin_master',
    isFeatured: false,
    isHidden: false,
    versions: [
      {
        versionNumber: 1,
        status: 'published',
        difficulty: 'hard',
        durationMs: 1_800_000,
        passingScorePercent: 75,
        rewardXp: 500,
        questions: [
          {
            position: 1,
            questionText: 'What is the time complexity of merge sort in the average case?',
            answerOptions: [
              { position: 1, value: 'O(n)', isCorrect: false },
              { position: 2, value: 'O(n log n)', isCorrect: true },
              { position: 3, value: 'O(n^2)', isCorrect: false },
              { position: 4, value: 'O(log n)', isCorrect: false },
            ],
          },
          {
            position: 2,
            questionText: 'Which algorithm finds the shortest path in a weighted graph with non-negative edges?',
            answerOptions: [
              { position: 1, value: "Bellman-Ford", isCorrect: false },
              { position: 2, value: "Dijkstra's algorithm", isCorrect: true },
              { position: 3, value: 'Floyd-Warshall only', isCorrect: false },
              { position: 4, value: 'DFS', isCorrect: false },
            ],
          },
          {
            position: 3,
            questionText: 'What is the space complexity of a recursive implementation of merge sort?',
            answerOptions: [
              { position: 1, value: 'O(1)', isCorrect: false },
              { position: 2, value: 'O(log n)', isCorrect: false },
              { position: 3, value: 'O(n)', isCorrect: true },
              { position: 4, value: 'O(n^2)', isCorrect: false },
            ],
          },
          {
            position: 4,
            questionText: 'In the context of dynamic programming, what does "optimal substructure" mean?',
            answerOptions: [
              { position: 1, value: 'All subproblems are equally sized', isCorrect: false },
              { position: 2, value: 'Optimal solution can be built from optimal solutions of subproblems', isCorrect: true },
              { position: 3, value: 'All solutions must be stored', isCorrect: false },
              { position: 4, value: 'The problem has no overlapping subproblems', isCorrect: false },
            ],
          },
          {
            position: 5,
            questionText: 'Which technique transforms a recursive solution into an iterative one using a stack?',
            answerOptions: [
              { position: 1, value: 'Memoization', isCorrect: false },
              { position: 2, value: 'Tabulation', isCorrect: false },
              { position: 3, value: 'Stack emulation', isCorrect: true },
              { position: 4, value: 'Tail call optimization', isCorrect: false },
            ],
          },
          {
            position: 6,
            questionText: "What is the time complexity of binary search on a sorted array?",
            answerOptions: [
              { position: 1, value: 'O(n)', isCorrect: false },
              { position: 2, value: 'O(log n)', isCorrect: true },
              { position: 3, value: 'O(n log n)', isCorrect: false },
              { position: 4, value: 'O(1)', isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
];

export { QUIZ_SEEDS };

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureQuiz(
  tx: SeedTx,
  lookup: SeedLookup,
  ctx: SeedContext,
  quiz: QuizSeed,
): Promise<{ quizId: string }> {
  const creatorId = await lookup.userIdByUsername(quiz.creatorUsername);

  const [existing] = await tx
    .select({ quizId: quizzes.quizId })
    .from(quizzes)
    .where(eq(quizzes.slug, quiz.slug))
    .limit(1);

  if (existing) {
    return { quizId: existing.quizId };
  }

  const [created] = await tx
    .insert(quizzes)
    .values({
      creatorId,
      title: quiz.title,
      slug: quiz.slug,
      description: quiz.description,
      isFeatured: quiz.isFeatured,
      isHidden: quiz.isHidden,
      isVerified: false,
      createdAt: ctx.nowIso,
      updatedAt: ctx.nowIso,
    })
    .returning({ quizId: quizzes.quizId });

  return { quizId: created.quizId };
}

async function ensureQuizVersion(
  tx: SeedTx,
  ctx: SeedContext,
  quizId: string,
  creatorId: string,
  version: QuizVersionSeed,
): Promise<string> {
  const [existing] = await tx
    .select({ quizVersionId: quizVersions.quizVersionId })
    .from(quizVersions)
    .where(
      sql`${quizVersions.quizId} = ${quizId} AND ${quizVersions.versionNumber} = ${version.versionNumber}`,
    )
    .limit(1);

  if (existing) {
    return existing.quizVersionId;
  }

  const [created] = await tx
    .insert(quizVersions)
    .values({
      quizId,
      versionNumber: version.versionNumber,
      status: version.status,
      difficulty: version.difficulty,
      durationMs: version.durationMs,
      passingScorePercent: version.passingScorePercent,
      rewardXp: version.rewardXp,
      createdByUserId: creatorId,
      publishedAt: version.status === 'published' ? ctx.nowIso : null,
      archivedAt: version.status === 'archived' ? ctx.nowIso : null,
      createdAt: ctx.nowIso,
      updatedAt: ctx.nowIso,
    })
    .returning({ quizVersionId: quizVersions.quizVersionId });

  return created.quizVersionId;
}

async function ensureQuestions(
  tx: SeedTx,
  ctx: SeedContext,
  quizVersionId: string,
  questions: QuizQuestionSeed[],
): Promise<void> {
  for (const question of questions) {
    const [q] = await tx
      .insert(quizQuestions)
      .values({
        quizVersionId,
        position: question.position,
        questionText: question.questionText,
        imageUrl: question.imageUrl ?? null,
        createdAt: ctx.nowIso,
        updatedAt: ctx.nowIso,
      })
      .onConflictDoNothing()
      .returning({ questionId: quizQuestions.questionId });

    if (!q) {
      // Already exists, skip options too
      continue;
    }

    await tx.insert(quizAnswerOptions).values(
      question.answerOptions.map((opt) => ({
        questionId: q.questionId,
        position: opt.position,
        value: opt.value,
        isCorrect: opt.isCorrect,
        createdAt: ctx.nowIso,
      })),
    ).onConflictDoNothing();
  }
}

// ─── Main run function ───────────────────────────────────────────────────────

export const runQuizSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    for (const quiz of QUIZ_SEEDS) {
      await logger.group(`Quiz: ${quiz.slug}`, async () => {
        const creatorId = await lookup.userIdByUsername(quiz.creatorUsername);
        const { quizId } = await ensureQuiz(tx, lookup, ctx, quiz);

        let questionsInserted = 0;
        let versionsInserted = 0;

        for (const version of quiz.versions) {
          const quizVersionId = await ensureQuizVersion(tx, ctx, quizId, creatorId, version);

          if (version.questions.length > 0) {
            await ensureQuestions(tx, ctx, quizVersionId, version.questions);
            questionsInserted += version.questions.length;
          }

          // Set publishedVersionId on quiz if this is the published version
          if (version.status === 'published') {
            await tx
              .update(quizzes)
              .set({ publishedVersionId: quizVersionId, updatedAt: ctx.nowIso })
              .where(eq(quizzes.quizId, quizId));
          }

          versionsInserted++;
          logger.info(`v${version.versionNumber} [${version.status}] with ${version.questions.length} questions`);
        }

        summaries.push({
          domain: `quiz:${quiz.slug}`,
          inserted: versionsInserted,
          updated: 0,
          skipped: 0,
        });
      });
    }
  });

  return summaries;
};
