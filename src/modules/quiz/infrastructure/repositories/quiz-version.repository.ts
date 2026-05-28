import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizVersions, quizzes } from '@/core/database/schema';
import { QuizConflictError, QuizDomainError } from '@/modules/quiz/domain/errors';
import { QUIZ_VERSION_CONFLICT_MESSAGE } from '@/modules/quiz/quiz.constants';
import type {
  QuizVersionDetailRow,
  QuizVersionRepositoryPort,
  QuizVersionRow,
} from '@/modules/quiz/domain/ports';
import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';
import type { UpdateQuizVersionCommand } from '@/modules/quiz/domain/types';

const QUIZ_VERSION_COLUMNS = quizVersions as unknown as {
  quizVersionId: AnyPgColumn;
  quizId: AnyPgColumn;
  versionNumber: AnyPgColumn;
  status: AnyPgColumn;
  difficulty: AnyPgColumn;
  durationMs: AnyPgColumn;
  passingScorePercent: AnyPgColumn;
  rewardXp: AnyPgColumn;
  createdByUserId: AnyPgColumn;
  createdAt: AnyPgColumn;
  publishedAt: AnyPgColumn;
  archivedAt: AnyPgColumn;
  updatedAt: AnyPgColumn;
};

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  creatorId: AnyPgColumn;
  isVerified: AnyPgColumn;
  isHidden: AnyPgColumn;
  deletedAt: AnyPgColumn;
};

const QUIZ_VERSION_PROJECTION = {
  quizVersionId: quizVersions.quizVersionId,
  quizId: quizVersions.quizId,
  versionNumber: quizVersions.versionNumber,
  status: quizVersions.status,
  difficulty: quizVersions.difficulty,
  durationMs: quizVersions.durationMs,
  passingScorePercent: quizVersions.passingScorePercent,
  rewardXp: quizVersions.rewardXp,
  createdByUserId: quizVersions.createdByUserId,
  createdAt: quizVersions.createdAt,
  publishedAt: quizVersions.publishedAt,
  archivedAt: quizVersions.archivedAt,
  updatedAt: quizVersions.updatedAt,
};

@Injectable()
export class QuizVersionRepository implements QuizVersionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getQuizVersionDetailById(quizVersionId: string): Promise<QuizVersionDetailRow | null> {
    const [row] = await this.db
      .select({
        quizVersionId: QUIZ_VERSION_COLUMNS.quizVersionId,
        quizId: QUIZ_VERSION_COLUMNS.quizId,
        versionNumber: QUIZ_VERSION_COLUMNS.versionNumber,
        status: QUIZ_VERSION_COLUMNS.status,
        difficulty: QUIZ_VERSION_COLUMNS.difficulty,
        durationMs: QUIZ_VERSION_COLUMNS.durationMs,
        passingScorePercent: QUIZ_VERSION_COLUMNS.passingScorePercent,
        rewardXp: QUIZ_VERSION_COLUMNS.rewardXp,
        createdByUserId: QUIZ_VERSION_COLUMNS.createdByUserId,
        createdAt: QUIZ_VERSION_COLUMNS.createdAt,
        publishedAt: QUIZ_VERSION_COLUMNS.publishedAt,
        archivedAt: QUIZ_VERSION_COLUMNS.archivedAt,
        updatedAt: QUIZ_VERSION_COLUMNS.updatedAt,
        quizCreatorId: QUIZ_COLUMNS.creatorId,
        quizIsVerified: QUIZ_COLUMNS.isVerified,
        quizIsHidden: QUIZ_COLUMNS.isHidden,
      })
      .from(quizVersions)
      .innerJoin(quizzes, eq(QUIZ_VERSION_COLUMNS.quizId, QUIZ_COLUMNS.quizId))
      .where(
        and(eq(QUIZ_VERSION_COLUMNS.quizVersionId, quizVersionId), isNull(QUIZ_COLUMNS.deletedAt)),
      )
      .limit(1);

    return (row as QuizVersionDetailRow | undefined) ?? null;
  }

  async getQuizVersionById(quizVersionId: string): Promise<QuizVersionRow | null> {
    const [row] = await this.db
      .select(QUIZ_VERSION_PROJECTION)
      .from(quizVersions)
      .where(eq(quizVersions.quizVersionId, quizVersionId))
      .limit(1);

    return (row as QuizVersionRow | undefined) ?? null;
  }

  async listQuizVersions(params: {
    quizId: string;
    limit: number;
    cursor?: { createdAt: string; quizVersionId: string } | null;
  }): Promise<QuizVersionRow[]> {
    const cursorCondition = params.cursor
      ? or(
          sql`${quizVersions.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(quizVersions.createdAt, params.cursor.createdAt),
            sql`${quizVersions.quizVersionId} < ${params.cursor.quizVersionId}`,
          ),
        )
      : undefined;

    const rows = await this.db
      .select(QUIZ_VERSION_PROJECTION)
      .from(quizVersions)
      .where(
        cursorCondition
          ? and(eq(quizVersions.quizId, params.quizId), cursorCondition)
          : eq(quizVersions.quizId, params.quizId),
      )
      .orderBy(desc(quizVersions.createdAt), desc(quizVersions.quizVersionId))
      .limit(params.limit + 1);

    return rows as QuizVersionRow[];
  }

  async createQuizVersion(params: {
    quizId: string;
    versionNumber: number;
    difficulty: QuizDifficulty;
    durationMs: number;
    passingScorePercent: number;
    rewardXp: number;
    createdByUserId: string;
    nowIso: string;
  }): Promise<QuizVersionRow> {
    try {
      const [createdVersion] = await this.db
        .insert(quizVersions)
        .values({
          quizId: params.quizId,
          versionNumber: params.versionNumber,
          status: 'draft',
          difficulty: params.difficulty,
          durationMs: params.durationMs,
          passingScorePercent: params.passingScorePercent,
          rewardXp: params.rewardXp,
          createdByUserId: params.createdByUserId,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning(QUIZ_VERSION_PROJECTION);

      return createdVersion as QuizVersionRow;
    } catch (error) {
      this.mapInsertError(error);
    }
  }

  async createDraftFromSourceVersion(params: {
    sourceVersion: QuizVersionDetailRow;
    userId: string;
    command?: UpdateQuizVersionCommand;
    nowIso: string;
  }): Promise<QuizVersionRow> {
    try {
      const nextVersionNumber = await this.getNextVersionNumber(params.sourceVersion.quizId);

      const [createdVersion] = await this.db
        .insert(quizVersions)
        .values({
          quizId: params.sourceVersion.quizId,
          versionNumber: nextVersionNumber,
          status: 'draft',
          difficulty: params.command?.difficulty ?? params.sourceVersion.difficulty,
          durationMs: params.command?.durationMs ?? params.sourceVersion.durationMs,
          passingScorePercent:
            params.command?.passingScorePercent ?? params.sourceVersion.passingScorePercent,
          rewardXp: params.command?.rewardXp ?? params.sourceVersion.rewardXp,
          createdByUserId: params.userId,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning(QUIZ_VERSION_PROJECTION);

      return createdVersion as QuizVersionRow;
    } catch (error) {
      this.mapInsertError(error);
    }
  }

  async getNextVersionNumber(quizId: string): Promise<number> {
    const [maxRow] = await this.db
      .select({
        maxVersionNumber: sql<number>`coalesce(max(${quizVersions.versionNumber}), 0)`,
      })
      .from(quizVersions)
      .where(eq(quizVersions.quizId, quizId));

    return (maxRow?.maxVersionNumber ?? 0) + 1;
  }

  async updateQuizVersion(params: {
    quizVersionId: string;
    patch: {
      difficulty: QuizDifficulty;
      durationMs: number;
      passingScorePercent: number;
      rewardXp: number;
      updatedAt: string;
    };
  }): Promise<void> {
    await this.db
      .update(quizVersions)
      .set(params.patch)
      .where(eq(quizVersions.quizVersionId, params.quizVersionId));
  }

  async publishQuizVersionAndSetQuiz(params: {
    quizId: string;
    quizVersionId: string;
    nowIso: string;
  }): Promise<QuizVersionRow | null> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx
          .update(quizVersions)
          .set({
            status: 'archived',
            archivedAt: params.nowIso,
            updatedAt: params.nowIso,
          })
          .where(
            and(
              eq(quizVersions.quizId, params.quizId),
              eq(quizVersions.status, 'published'),
              sql`${quizVersions.quizVersionId} <> ${params.quizVersionId}`,
            ),
          );

        const [publishedVersion] = await tx
          .update(quizVersions)
          .set({
            status: 'published',
            publishedAt: params.nowIso,
            archivedAt: null,
            updatedAt: params.nowIso,
          })
          .where(
            and(
              eq(quizVersions.quizVersionId, params.quizVersionId),
              eq(quizVersions.status, 'draft'),
            ),
          )
          .returning(QUIZ_VERSION_PROJECTION);

        if (!publishedVersion) {
          return null;
        }

        await tx
          .update(quizzes)
          .set({
            publishedVersionId: params.quizVersionId,
            updatedAt: params.nowIso,
          })
          .where(eq(QUIZ_COLUMNS.quizId, params.quizId));

        return publishedVersion as QuizVersionRow;
      });
    } catch (error) {
      this.mapInsertError(error);
    }
  }

  private mapInsertError(error: unknown): never {
    const maybePgError = error as { code?: string; constraint?: string };

    if (maybePgError.code === '23505') {
      throw new QuizConflictError(QUIZ_VERSION_CONFLICT_MESSAGE);
    }

    if (maybePgError.code === '23503') {
      throw new QuizConflictError('Quiz not found');
    }

    throw new QuizDomainError('Quiz version operation failed');
  }
}
