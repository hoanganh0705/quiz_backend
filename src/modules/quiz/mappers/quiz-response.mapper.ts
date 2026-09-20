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

export type QuizProjectionContext = {
  authorsByUserId?: Map<string, AuthorSummaryRow>;
  categoriesById?: Map<string, CategorySummaryRow>;
  tagsByQuizId?: Map<string, QuizTagDto[]>;
  aggregatesByQuizId?: Map<string, QuizAggregatesRow>;
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
