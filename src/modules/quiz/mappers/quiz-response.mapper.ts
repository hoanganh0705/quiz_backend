import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_PORT, type StoragePort } from '@/core/storage/storage.port';
import type { UploadPurpose } from '@/core/storage/storage.types';
import type {
  AuthorSummaryRow,
  CategorySummaryRow,
  QuizAggregatesRow,
  QuizWithPublishedVersionRow,
} from '../domain/ports/quiz-repository.port';
import type { QuizQuestionAuthorDto } from '../dto/response/quiz-question-author.dto';
import type { QuizQuestionPlayerDto } from '../dto/response/quiz-question-player.dto';
import type { QuizTagDto } from '../dto/response/quiz-tag.dto';
import type { QuizVersionResponseDto } from '../dto/response/quiz-version-response.dto';
import type { AuthorSummaryDto } from '../dto/response/author-summary.dto';
import type { QuizResponseDto } from '../dto/response/quiz-response.dto';
import type { QuizListItemDto } from '../dto/response/quiz-list-item.dto';

/**
 * Pure stateless mapper — no DI needed.
 * Translates QuizWithPublishedVersionRow database projections to QuizResponseDto.
 *
 * Phase 2 (S-6 + S-7 + S-8) threading model:
 * the list/detail path used to take just the row plus optional
 * `publishedQuestions` / `tags`. It now takes an optional
 * `QuizProjectionContext` carrying the four batched lookups
 * (creators, categories, tags, aggregates, question counts). The
 * mapper stitches them onto the projection purely defensively — if
 * the context is missing (e.g. a code path that has not been
 * migrated yet), every enriched field reads as the documented
 * default (`null` for embedded objects, `0` for counts) so the
 * wire shape stays valid.
 *
 * `publishedQuestions` accepts either player or author question DTOs.
 * The public `GET /quizzes/:id` endpoint passes player questions (no
 * `isCorrect`); no current code path passes author questions here, but
 * the union keeps the mapper reusable if an author-only detail route is
 * added later.
 */
export type QuizProjectionContext = {
  /**
   * Batched `users` + `user_profiles` LEFT JOIN keyed by `userId`.
   * Drives `creator` on the response. Absent users are surfaced
   * as `null` so the wire shape stays valid.
   */
  authorsByUserId?: Map<string, AuthorSummaryRow>;
  /**
   * Batched `categories` join keyed by `categoryId`. Drives
   * `categoryName` / `categorySlug`. Absent categories read as
   * `null` (the category was deleted or never set).
   */
  categoriesById?: Map<string, CategorySummaryRow>;
  /**
   * Batched `tags` join keyed by `quizId`. Drives `tags`. Quizzes
   * without rows in the result map simply have an empty tag list.
   */
  tagsByQuizId?: Map<string, QuizTagDto[]>;
  /**
   * Batched `quiz_stats` aggregates keyed by `quizId`. Drives
   * `averageRating` / `reviewCount` / `attemptCount`. Quizzes
   * without rows read as zero counters.
   */
  aggregatesByQuizId?: Map<string, QuizAggregatesRow>;
  /**
   * Batched question counts keyed by `quizVersionId`. Drives
   * `publishedVersion.questionCount`. Versions without a row read
   * as zero.
   */
  questionCountByVersionId?: Map<string, number>;
};

const EMPTY_CONTEXT: QuizProjectionContext = Object.freeze({});

function resolveAuthor(
  row: QuizWithPublishedVersionRow,
  context: QuizProjectionContext,
  storage: StoragePort,
): AuthorSummaryDto | null {
  if (!row.creatorId) return null;
  const found = context.authorsByUserId?.get(row.creatorId);
  if (!found) return null;
  const avatarUrl = found.avatarPublicId
    ? storage.deriveUrl(found.avatarPublicId, 'avatar' as UploadPurpose)
    : found.avatarUrl;
  return {
    userId: found.userId,
    username: found.username,
    displayName: found.displayName,
    avatarUrl,
  };
}

function resolveCategoryName(
  context: QuizProjectionContext,
  quiz: QuizWithPublishedVersionRow,
): string | null {
  if (!quiz.categoryId) return null;
  return context.categoriesById?.get(quiz.categoryId)?.name ?? null;
}

function resolveCategorySlug(
  context: QuizProjectionContext,
  quiz: QuizWithPublishedVersionRow,
): string | null {
  if (!quiz.categoryId) return null;
  return context.categoriesById?.get(quiz.categoryId)?.slug ?? null;
}

@Injectable()
export class QuizResponseMapper {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  /**
   * Resolve the cover image URL for a quiz row, preferring
   * `imagePublicId` (Cloudinary) and falling back to legacy
   * `imageUrl` (raw seed/external URL). Returns `null` when neither
   * is present.
   */
  private deriveImageUrl(
    row: Pick<QuizWithPublishedVersionRow, 'imageUrl' | 'imagePublicId'>,
  ): string | null {
    if (row.imagePublicId) {
      return this.storage.deriveUrl(row.imagePublicId, 'quiz' as UploadPurpose);
    }
    return row.imageUrl ?? null;
  }

  toQuizResponse(
    row: QuizWithPublishedVersionRow,
    publishedQuestions?: (QuizQuestionPlayerDto | QuizQuestionAuthorDto)[],
    tags: QuizTagDto[] = [],
    context: QuizProjectionContext = EMPTY_CONTEXT,
  ): QuizResponseDto {
    const imageUrl = this.deriveImageUrl(row);
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
        creator: resolveAuthor(row, context, this.storage),
        title: row.title,
        description: row.description,
        slug: row.slug,
        requirements: row.requirements,
        imageUrl,
        categoryId: row.categoryId,
        categoryName: resolveCategoryName(context, row),
        categorySlug: resolveCategorySlug(context, row),
        isFeatured: row.isFeatured,
        isHidden: row.isHidden,
        isVerified: row.isVerified,
        publishedVersionId: row.publishedVersionId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        publishedVersion: null,
        tags,
      };
    }

    const questionCount = row.publishedVersionQuizVersionId
      ? (context.questionCountByVersionId?.get(row.publishedVersionQuizVersionId) ?? 0)
      : 0;

    const publishedVersion: QuizVersionResponseDto = {
      quizVersionId: row.publishedVersionQuizVersionId!,
      quizId: row.quizId,
      versionNumber: row.publishedVersionVersionNumber!,
      status: row.publishedVersionStatus!,
      difficulty: row.publishedVersionDifficulty!,
      durationMs: row.publishedVersionDurationMs!,
      passingScorePercent: row.publishedVersionPassingScorePercent!,
      rewardXp: row.publishedVersionRewardXp!,
      questionCount,
      creatorId: row.publishedVersionCreatedByUserId,
      createdAt: row.publishedVersionCreatedAt!,
      publishedAt: row.publishedVersionPublishedAt,
      archivedAt: row.publishedVersionArchivedAt,
      updatedAt: row.publishedVersionUpdatedAt!,
    };

    if (publishedQuestions) {
      // `QuizVersionResponseDto.questions` is typed as `QuizQuestionAuthorDto[]?`
      // — both author and player DTOs share the same questionId/quizVersionId/
      // position/questionText/imageUrl/createdAt/updatedAt/answerOptions shape,
      // so the assignment is structurally safe. Author DTOs add `isCorrect`
      // to each option; player DTOs omit it.
      publishedVersion.questions = publishedQuestions as QuizQuestionAuthorDto[];
    }

    return {
      quizId: row.quizId,
      creatorId: row.creatorId,
      creator: resolveAuthor(row, context, this.storage),
      title: row.title,
      description: row.description,
      slug: row.slug,
      requirements: row.requirements,
      imageUrl,
      categoryId: row.categoryId,
      categoryName: resolveCategoryName(context, row),
      categorySlug: resolveCategorySlug(context, row),
      isFeatured: row.isFeatured,
      isHidden: row.isHidden,
      isVerified: row.isVerified,
      publishedVersionId: row.publishedVersionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedVersion,
      tags,
    };
  }

  /**
   * Slim projection for listing endpoints. Produces a `QuizListItemDto`.
   *
   * Phase 2 (S-6): tags are now folded in here (previously detail-only)
   * via the `tagsByQuizId` batched map. The list also reads
   * creator / category / aggregates / question-count fields off the
   * same context object, so a page of 20 quizzes resolves with
   * exactly five SQL queries (page + tags + authors + categories +
   * stats) instead of 1 + 4×N.
   */
  toListItem(
    row: QuizWithPublishedVersionRow,
    context: QuizProjectionContext = EMPTY_CONTEXT,
  ): QuizListItemDto {
    const full = this.toQuizResponse(
      row,
      undefined,
      context.tagsByQuizId?.get(row.quizId) ?? [],
      context,
    );
    const aggregates = context.aggregatesByQuizId?.get(row.quizId);

    return {
      quizId: full.quizId,
      creatorId: full.creatorId,
      creator: full.creator,
      title: full.title,
      description: full.description,
      slug: full.slug,
      requirements: full.requirements,
      imageUrl: full.imageUrl,
      categoryId: full.categoryId,
      categoryName: full.categoryName,
      categorySlug: full.categorySlug,
      isFeatured: full.isFeatured,
      isHidden: full.isHidden,
      isVerified: full.isVerified,
      publishedVersionId: full.publishedVersionId,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
      publishedVersion: full.publishedVersion,
      questionCount: full.publishedVersion?.questionCount ?? 0,
      averageRating: aggregates?.averageRating ?? 0,
      reviewCount: aggregates?.reviewCount ?? 0,
      attemptCount: aggregates?.attemptCount ?? 0,
      tags: full.tags,
    };
  }
}
