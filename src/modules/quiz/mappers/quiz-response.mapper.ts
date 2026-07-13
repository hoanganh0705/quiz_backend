import type { QuizWithPublishedVersionRow } from '../domain/ports/quiz-repository.port';
import type { QuizQuestionResponseDto } from '../dto/response/quiz-question-response.dto';
import type { QuizTagDto } from '../dto/response/quiz-tag.dto';
import type { QuizVersionResponseDto } from '../dto/response/quiz-version-response.dto';
import type { QuizResponseDto } from '../dto/response/quiz-response.dto';
import type { QuizListItemDto } from '../dto/response/quiz-list-item.dto';

/**
 * Pure stateless mapper — no DI needed.
 * Translates QuizWithPublishedVersionRow database projections to QuizResponseDto.
 *
 * The optional `tags` argument is populated only on detail endpoints
 * (`getQuizById`, `getQuizBySlug`, `createQuiz`, `updateQuiz`). Listing
 * endpoints use `toListItem` instead, which produces a slim shape that
 * omits the `tags` field.
 */
export class QuizResponseMapper {
  static toQuizResponse(
    row: QuizWithPublishedVersionRow,
    publishedQuestions?: QuizQuestionResponseDto[],
    tags: QuizTagDto[] = [],
  ): QuizResponseDto {
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
        tags,
      };
    }

    const publishedVersion: QuizVersionResponseDto = {
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
    };

    if (publishedQuestions) {
      publishedVersion.questions = publishedQuestions;
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
      publishedVersion,
      tags,
    };
  }

  /**
   * Slim projection for listing endpoints. Produces a `QuizListItemDto`
   * that omits `tags` — listing payloads stay small and avoid the batched
   * join needed to populate tag data across a whole page.
   */
  static toListItem(row: QuizWithPublishedVersionRow): QuizListItemDto {
    const full = this.toQuizResponse(row);
    return {
      quizId: full.quizId,
      creatorId: full.creatorId,
      title: full.title,
      description: full.description,
      slug: full.slug,
      requirements: full.requirements,
      imageUrl: full.imageUrl,
      isFeatured: full.isFeatured,
      isHidden: full.isHidden,
      isVerified: full.isVerified,
      publishedVersionId: full.publishedVersionId,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
      publishedVersion: full.publishedVersion,
    };
  }
}
