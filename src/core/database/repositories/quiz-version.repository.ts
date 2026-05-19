import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.constants';
import type { DrizzleDB } from '../database.module';
import { quizVersions, quizzes } from '../schema';
import type {
  QuizVersionDetailRow,
  QuizVersionRepositoryPort,
  QuizVersionRow,
} from '@/modules/quiz/domain/ports';
import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';
import type { UpdateQuizVersionDto } from '@/modules/quiz/dto/request/update-quiz-version.dto';

@Injectable()
export class QuizVersionRepository implements QuizVersionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getQuizVersionDetailById(quizVersionId: string): Promise<QuizVersionDetailRow | null> {
    const [row] = await this.db
      .select({
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
        quizCreatorId: quizzes.creatorId,
        quizIsVerified: quizzes.isVerified,
        quizIsHidden: quizzes.isHidden,
      })
      .from(quizVersions)
      .innerJoin(quizzes, eq(quizVersions.quizId, quizzes.quizId))
      .where(and(eq(quizVersions.quizVersionId, quizVersionId), isNull(quizzes.deletedAt)))
      .limit(1);

    return (row as QuizVersionDetailRow | undefined) ?? null;
  }

  async getQuizVersionById(quizVersionId: string): Promise<QuizVersionRow | null> {
    const [row] = await this.db
      .select({
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
      })
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
      .select({
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
      })
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
      .returning({
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
      });

    return createdVersion as QuizVersionRow;
  }

  async createDraftFromSourceVersion(params: {
    sourceVersion: QuizVersionDetailRow;
    userId: string;
    payload?: UpdateQuizVersionDto;
    nowIso: string;
  }): Promise<QuizVersionRow> {
    const nextVersionNumber = await this.getNextVersionNumber(params.sourceVersion.quizId);

    const [createdVersion] = await this.db
      .insert(quizVersions)
      .values({
        quizId: params.sourceVersion.quizId,
        versionNumber: nextVersionNumber,
        status: 'draft',
        difficulty: params.payload?.difficulty ?? params.sourceVersion.difficulty,
        durationMs: params.payload?.durationMs ?? params.sourceVersion.durationMs,
        passingScorePercent:
          params.payload?.passingScorePercent ?? params.sourceVersion.passingScorePercent,
        rewardXp: params.payload?.rewardXp ?? params.sourceVersion.rewardXp,
        createdByUserId: params.userId,
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
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
      });

    return createdVersion as QuizVersionRow;
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
    return this.db.transaction(async (tx) => {
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
        .returning({
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
        });

      if (!publishedVersion) {
        return null;
      }

      await tx
        .update(quizzes)
        .set({
          publishedVersionId: params.quizVersionId,
          updatedAt: params.nowIso,
        })
        .where(eq(quizzes.quizId, params.quizId));

      return publishedVersion as QuizVersionRow;
    });
  }
}
