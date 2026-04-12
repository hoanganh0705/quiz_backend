/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { UserRole } from '@/common/decorators/roles.decorator';
import { JwtPayload } from '@/common/guards/jwt.guard';
import { DRIZZLE, type DrizzleDB } from '@/core/database/database.module';
import { quizCategories, quizTags, quizVersions, quizzes } from '@/core/database/schema';
import { CreateQuizDto } from './dto/request/create-quiz.dto';
import { CreateQuizVersionDto } from './dto/request/create-quiz-version.dto';
import { ListQuizVersionsQueryDto } from './dto/request/list-quiz-versions-query.dto';
import { QuizVersionResponseDto } from './dto/response/quiz-version-response.dto';
import {
  CreateQuizLinkIds,
  QuizCursorPayload,
  QuizDifficulty,
  QuizVersionCursorPayload,
  QuizVersionStatus,
} from './types/quiz.types';
import { QuizResponseDto } from './dto/response/quiz-response.dto';
import { ListQuizzesQueryDto } from './dto/request/list-quizzes-query.dto';
import { QuizListResponseDto } from './dto/response/quiz-list-response.dto';
import { QuizVersionListResponseDto } from './dto/response/quiz-version-list-response.dto';
import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
  isStringMatchingPattern,
} from '@/common/utils/cursor.util';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { normalizeNullableText } from '@/common/utils/text.util';

type QuizWithPublishedVersionRow = {
  quizId: string;
  creatorId: string | null;
  title: string;
  description: string | null;
  slug: string;
  requirements: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isHidden: boolean;
  isVerified: boolean;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedVersionQuizVersionId: string | null;
  publishedVersionVersionNumber: number | null;
  publishedVersionStatus: QuizVersionStatus | null;
  publishedVersionDifficulty: QuizDifficulty | null;
  publishedVersionDurationMs: number | null;
  publishedVersionPassingScorePercent: number | null;
  publishedVersionRewardXp: number | null;
  publishedVersionCreatedByUserId: string | null;
  publishedVersionCreatedAt: string | null;
  publishedVersionPublishedAt: string | null;
  publishedVersionArchivedAt: string | null;
  publishedVersionUpdatedAt: string | null;
};

@Injectable()
export class QuizService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private static readonly QUIZ_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  private readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private isCreatorOrAdmin(role: UserRole): boolean {
    return role === 'creator' || role === 'admin';
  }

  private decodeQuizCursor(cursor: string): QuizCursorPayload {
    const parsed = decodeBase64JsonCursor<QuizCursorPayload>(cursor);

    if (
      !isIsoDateString(parsed.createdAt) ||
      !isStringMatchingPattern(parsed.quizId, this.uuidPattern)
    ) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      quizId: parsed.quizId,
    };
  }

  private decodeQuizVersionCursor(cursor: string): QuizVersionCursorPayload {
    const parsed = decodeBase64JsonCursor<QuizVersionCursorPayload>(cursor);

    if (
      !isIsoDateString(parsed.createdAt) ||
      !isStringMatchingPattern(parsed.quizVersionId, this.uuidPattern)
    ) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      quizVersionId: parsed.quizVersionId,
    };
  }

  private encodeQuizCursor(quiz: Pick<QuizResponseDto, 'createdAt' | 'quizId'>): string {
    return encodeBase64JsonCursor({ createdAt: quiz.createdAt, quizId: quiz.quizId });
  }

  private encodeQuizVersionCursor(
    version: Pick<QuizVersionResponseDto, 'createdAt' | 'quizVersionId'>,
  ): string {
    return encodeBase64JsonCursor({
      createdAt: version.createdAt,
      quizVersionId: version.quizVersionId,
    });
  }

  private mapQuizRow(row: QuizWithPublishedVersionRow): QuizResponseDto {
    const hasPublishedVersion =
      row.publishedVersionQuizVersionId !== null &&
      row.publishedVersionVersionNumber !== null &&
      row.publishedVersionStatus !== null &&
      row.publishedVersionDifficulty !== null &&
      row.publishedVersionDurationMs !== null &&
      row.publishedVersionPassingScorePercent !== null &&
      row.publishedVersionRewardXp !== null &&
      row.publishedVersionCreatedAt !== null &&
      row.publishedVersionUpdatedAt !== null;

    if (!hasPublishedVersion) {
      return {
        quizId: row.quizId,
        creatorId: row.creatorId,
        title: row.title,
        description: row.description,
        slug: row.slug,
        requirements: row.requirements,
        imageUrl: row.imageUrl,
        isFeatured: row.isFeatured,
        isHidden: row.isHidden,
        isVerified: row.isVerified,
        publishedVersionId: row.publishedVersionId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        publishedVersion: null,
      };
    }

    return {
      quizId: row.quizId,
      creatorId: row.creatorId,
      title: row.title,
      description: row.description,
      slug: row.slug,
      requirements: row.requirements,
      imageUrl: row.imageUrl,
      isFeatured: row.isFeatured,
      isHidden: row.isHidden,
      isVerified: row.isVerified,
      publishedVersionId: row.publishedVersionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedVersion: {
        quizVersionId: row.publishedVersionQuizVersionId!,
        quizId: row.quizId,
        versionNumber: row.publishedVersionVersionNumber!,
        status: row.publishedVersionStatus!,
        difficulty: row.publishedVersionDifficulty!,
        durationMs: row.publishedVersionDurationMs!,
        passingScorePercent: row.publishedVersionPassingScorePercent!,
        rewardXp: row.publishedVersionRewardXp!,
        createdByUserId: row.publishedVersionCreatedByUserId,
        createdAt: row.publishedVersionCreatedAt!,
        publishedAt: row.publishedVersionPublishedAt,
        archivedAt: row.publishedVersionArchivedAt,
        updatedAt: row.publishedVersionUpdatedAt!,
      },
    };
  }

  private mapVersionInsertError(error: unknown): never {
    const maybePgError = error as { code?: string; constraint?: string };

    if (maybePgError.code === '23505') {
      throw new ConflictException('Quiz version already exists');
    }

    if (maybePgError.code === '23503') {
      throw new NotFoundException('Quiz not found');
    }

    throw new InternalServerErrorException('Quiz version operation failed');
  }

  private mapQuizCreateError(error: unknown): never {
    const maybePgError = error as { code?: string; constraint?: string };

    if (maybePgError.code === '23505') {
      throw new ConflictException('Quiz slug already exists');
    }

    if (maybePgError.code === '23503') {
      throw new BadRequestException('One or more category IDs or tag IDs do not exist');
    }

    throw new InternalServerErrorException('Quiz operation failed');
  }

  private async getActiveQuizRecordById(
    quizId: string,
  ): Promise<{ quizId: string; creatorId: string | null }> {
    const [quiz] = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
      })
      .from(quizzes)
      .where(and(eq(quizzes.quizId, quizId), isNull(quizzes.deletedAt)))
      .limit(1);

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return quiz;
  }

  private async assertQuizManagePermission(quizId: string, user: JwtPayload): Promise<void> {
    if (!this.isCreatorOrAdmin(user.role)) {
      throw new ForbiddenException('You do not have permission to manage this quiz');
    }

    const quiz = await this.getActiveQuizRecordById(quizId);

    if (user.role === 'admin') {
      return;
    }

    if (!quiz.creatorId || quiz.creatorId !== user.sub) {
      throw new ForbiddenException('Only the quiz creator can manage this quiz');
    }
  }

  private normalizeLinkIds(values?: string[]): CreateQuizLinkIds {
    if (!values || values.length === 0) {
      return [];
    }

    return [...new Set(values.map((value) => value.trim()))];
  }

  private async getQuizById(quizId: string): Promise<QuizResponseDto> {
    const [row] = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
        title: quizzes.title,
        description: quizzes.description,
        slug: quizzes.slug,
        requirements: quizzes.requirements,
        imageUrl: quizzes.imageUrl,
        isFeatured: quizzes.isFeatured,
        isHidden: quizzes.isHidden,
        isVerified: quizzes.isVerified,
        publishedVersionId: quizzes.publishedVersionId,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        publishedVersionQuizVersionId: quizVersions.quizVersionId,
        publishedVersionVersionNumber: quizVersions.versionNumber,
        publishedVersionStatus: quizVersions.status,
        publishedVersionDifficulty: quizVersions.difficulty,
        publishedVersionDurationMs: quizVersions.durationMs,
        publishedVersionPassingScorePercent: quizVersions.passingScorePercent,
        publishedVersionRewardXp: quizVersions.rewardXp,
        publishedVersionCreatedByUserId: quizVersions.createdByUserId,
        publishedVersionCreatedAt: quizVersions.createdAt,
        publishedVersionPublishedAt: quizVersions.publishedAt,
        publishedVersionArchivedAt: quizVersions.archivedAt,
        publishedVersionUpdatedAt: quizVersions.updatedAt,
      })
      .from(quizzes)
      .leftJoin(quizVersions, eq(quizzes.publishedVersionId, quizVersions.quizVersionId))
      .where(and(eq(quizzes.quizId, quizId), isNull(quizzes.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Quiz not found');
    }

    return this.mapQuizRow(row);
  }

  async createQuiz(user: JwtPayload, payload: CreateQuizDto): Promise<QuizResponseDto> {
    const title = payload.title.trim();
    const slug = payload.slug
      ? normalizeSlugOrThrow(payload.slug, {
          pattern: QuizService.QUIZ_SLUG_PATTERN,
          emptyMessage: 'Quiz slug cannot be empty',
          invalidMessage:
            'Quiz slug must be lowercase and can only contain letters, numbers, and hyphens',
        })
      : normalizeSlugOrThrow(buildSlug(title), {
          pattern: QuizService.QUIZ_SLUG_PATTERN,
          emptyMessage: 'Quiz slug cannot be empty',
          invalidMessage:
            'Quiz slug must be lowercase and can only contain letters, numbers, and hyphens',
        });
    const description = normalizeNullableText(payload.description);
    const requirements = normalizeNullableText(payload.requirements);
    const imageUrl = normalizeNullableText(payload.imageUrl);
    const categoryIds = this.normalizeLinkIds(payload.categoryIds);
    const tagIds = this.normalizeLinkIds(payload.tagIds);
    const nowIso = new Date().toISOString();

    let createdQuizId = '';

    try {
      await this.db.transaction(async (tx) => {
        const [quiz] = await tx
          .insert(quizzes)
          .values({
            creatorId: user.sub,
            title,
            slug,
            description,
            requirements,
            imageUrl,
            isFeatured: payload.isFeatured ?? false,
            isHidden: payload.isHidden ?? false,
            isVerified: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          })
          .returning({
            quizId: quizzes.quizId,
          });

        createdQuizId = quiz.quizId;

        await tx.insert(quizVersions).values({
          quizId: quiz.quizId,
          versionNumber: 1,
          status: 'draft',
          difficulty: payload.initialVersion.difficulty,
          durationMs: payload.initialVersion.durationMs,
          passingScorePercent: payload.initialVersion.passingScorePercent,
          rewardXp: payload.initialVersion.rewardXp,
          createdByUserId: user.sub,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        if (categoryIds.length > 0) {
          await tx.insert(quizCategories).values(
            categoryIds.map((categoryId) => ({
              quizId: quiz.quizId,
              categoryId,
              createdAt: nowIso,
            })),
          );
        }

        if (tagIds.length > 0) {
          await tx.insert(quizTags).values(
            tagIds.map((tagId) => ({
              quizId: quiz.quizId,
              tagId,
              createdAt: nowIso,
            })),
          );
        }
      });
    } catch (error: unknown) {
      this.mapQuizCreateError(error);
    }

    return this.getQuizById(createdQuizId);
  }

  async listQuizzes(query: ListQuizzesQueryDto): Promise<QuizListResponseDto> {
    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? this.decodeQuizCursor(cursorValue) : null;

    const filters: SQL[] = [isNull(quizzes.deletedAt), eq(quizzes.isHidden, false)];

    if (query.difficulty) {
      filters.push(
        sql`exists (
					select 1
					from ${quizVersions} qv_filter
					where qv_filter.quiz_id = ${quizzes.quizId}
						and qv_filter.quiz_version_id = ${quizzes.publishedVersionId}
						and qv_filter.difficulty = ${query.difficulty}
				)`,
      );
    }

    if (query.categoryId) {
      filters.push(
        sql`exists (
					select 1
					from ${quizCategories} qc_filter
					where qc_filter.quiz_id = ${quizzes.quizId}
						and qc_filter.category_id = ${query.categoryId}
				)`,
      );
    }

    if (query.tagId) {
      filters.push(
        sql`exists (
					select 1
					from ${quizTags} qt_filter
					where qt_filter.quiz_id = ${quizzes.quizId}
						and qt_filter.tag_id = ${query.tagId}
				)`,
      );
    }

    if (cursor) {
      filters.push(
        or(
          sql`${quizzes.createdAt} < ${cursor.createdAt}`,
          and(eq(quizzes.createdAt, cursor.createdAt), sql`${quizzes.quizId} < ${cursor.quizId}`),
        ) as SQL,
      );
    }

    const rows = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
        title: quizzes.title,
        description: quizzes.description,
        slug: quizzes.slug,
        requirements: quizzes.requirements,
        imageUrl: quizzes.imageUrl,
        isFeatured: quizzes.isFeatured,
        isHidden: quizzes.isHidden,
        isVerified: quizzes.isVerified,
        publishedVersionId: quizzes.publishedVersionId,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        publishedVersionQuizVersionId: quizVersions.quizVersionId,
        publishedVersionVersionNumber: quizVersions.versionNumber,
        publishedVersionStatus: quizVersions.status,
        publishedVersionDifficulty: quizVersions.difficulty,
        publishedVersionDurationMs: quizVersions.durationMs,
        publishedVersionPassingScorePercent: quizVersions.passingScorePercent,
        publishedVersionRewardXp: quizVersions.rewardXp,
        publishedVersionCreatedByUserId: quizVersions.createdByUserId,
        publishedVersionCreatedAt: quizVersions.createdAt,
        publishedVersionPublishedAt: quizVersions.publishedAt,
        publishedVersionArchivedAt: quizVersions.archivedAt,
        publishedVersionUpdatedAt: quizVersions.updatedAt,
      })
      .from(quizzes)
      .leftJoin(quizVersions, eq(quizzes.publishedVersionId, quizVersions.quizVersionId))
      .where(and(...filters))
      .orderBy(desc(quizzes.createdAt), desc(quizzes.quizId))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage
      ? rows.slice(0, limit).map((row) => this.mapQuizRow(row))
      : rows.map((row) => this.mapQuizRow(row));
    const lastItem = items.at(-1);

    return {
      items,
      pagination: {
        limit,
        nextCursor: hasNextPage && lastItem ? this.encodeQuizCursor(lastItem) : null,
        hasNextPage,
      },
    };
  }

  async getQuizBySlug(slug: string): Promise<QuizResponseDto> {
    const normalizedSlug = normalizeSlugOrThrow(slug, {
      pattern: QuizService.QUIZ_SLUG_PATTERN,
      emptyMessage: 'Quiz slug cannot be empty',
      invalidMessage:
        'Quiz slug must be lowercase and can only contain letters, numbers, and hyphens',
    });

    const [row] = await this.db
      .select({
        quizId: quizzes.quizId,
        creatorId: quizzes.creatorId,
        title: quizzes.title,
        description: quizzes.description,
        slug: quizzes.slug,
        requirements: quizzes.requirements,
        imageUrl: quizzes.imageUrl,
        isFeatured: quizzes.isFeatured,
        isHidden: quizzes.isHidden,
        isVerified: quizzes.isVerified,
        publishedVersionId: quizzes.publishedVersionId,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        publishedVersionQuizVersionId: quizVersions.quizVersionId,
        publishedVersionVersionNumber: quizVersions.versionNumber,
        publishedVersionStatus: quizVersions.status,
        publishedVersionDifficulty: quizVersions.difficulty,
        publishedVersionDurationMs: quizVersions.durationMs,
        publishedVersionPassingScorePercent: quizVersions.passingScorePercent,
        publishedVersionRewardXp: quizVersions.rewardXp,
        publishedVersionCreatedByUserId: quizVersions.createdByUserId,
        publishedVersionCreatedAt: quizVersions.createdAt,
        publishedVersionPublishedAt: quizVersions.publishedAt,
        publishedVersionArchivedAt: quizVersions.archivedAt,
        publishedVersionUpdatedAt: quizVersions.updatedAt,
      })
      .from(quizzes)
      .leftJoin(quizVersions, eq(quizzes.publishedVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizzes.slug, normalizedSlug),
          isNull(quizzes.deletedAt),
          eq(quizzes.isHidden, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Quiz not found');
    }

    return this.mapQuizRow(row);
  }

  async createQuizVersion(
    quizId: string,
    user: JwtPayload,
    payload: CreateQuizVersionDto,
  ): Promise<QuizVersionResponseDto> {
    await this.assertQuizManagePermission(quizId, user);

    if (payload.sourceVersionId) {
      const [sourceVersion] = await this.db
        .select({
          quizVersionId: quizVersions.quizVersionId,
        })
        .from(quizVersions)
        .where(
          and(
            eq(quizVersions.quizId, quizId),
            eq(quizVersions.quizVersionId, payload.sourceVersionId),
          ),
        )
        .limit(1);

      if (!sourceVersion) {
        throw new NotFoundException('Source version not found for this quiz');
      }
    }

    const [maxRow] = await this.db
      .select({
        maxVersionNumber: sql<number>`coalesce(max(${quizVersions.versionNumber}), 0)`,
      })
      .from(quizVersions)
      .where(eq(quizVersions.quizId, quizId));

    const versionNumber = (maxRow?.maxVersionNumber ?? 0) + 1;

    const [createdVersion] = await this.db
      .insert(quizVersions)
      .values({
        quizId,
        versionNumber,
        status: 'draft',
        difficulty: payload.difficulty,
        durationMs: payload.durationMs,
        passingScorePercent: payload.passingScorePercent,
        rewardXp: payload.rewardXp,
        createdByUserId: user.sub,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      })
      .catch((error: unknown) => this.mapVersionInsertError(error));

    return createdVersion;
  }

  async listQuizVersions(
    quizId: string,
    user: JwtPayload,
    query: ListQuizVersionsQueryDto,
  ): Promise<QuizVersionListResponseDto> {
    await this.assertQuizManagePermission(quizId, user);

    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? this.decodeQuizVersionCursor(cursorValue) : null;

    const cursorCondition = cursor
      ? or(
          sql`${quizVersions.createdAt} < ${cursor.createdAt}`,
          and(
            eq(quizVersions.createdAt, cursor.createdAt),
            sql`${quizVersions.quizVersionId} < ${cursor.quizVersionId}`,
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
          ? and(eq(quizVersions.quizId, quizId), cursorCondition)
          : eq(quizVersions.quizId, quizId),
      )
      .orderBy(desc(quizVersions.createdAt), desc(quizVersions.quizVersionId))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      pagination: {
        limit,
        nextCursor: hasNextPage && lastItem ? this.encodeQuizVersionCursor(lastItem) : null,
        hasNextPage,
      },
    };
  }
}
