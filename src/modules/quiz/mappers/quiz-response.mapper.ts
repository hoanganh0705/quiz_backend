import type { QuizWithPublishedVersionRow } from '../domain/ports/quiz-repository.port';
import type { QuizQuestionAuthorDto } from '../dto/response/quiz-question-author.dto';
import type { QuizQuestionPlayerDto } from '../dto/response/quiz-question-player.dto';
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
 *
 * `publishedQuestions` accepts either player or author question DTOs.
 * The public `GET /quizzes/:id` endpoint passes player questions (no
 * `isCorrect`); no current code path passes author questions here, but
 * the union keeps the mapper reusable if an author-only detail route is
 * added later.
 */
export class QuizResponseMapper {
  static toQuizResponse(
    row: QuizWithPublishedVersionRow,
    publishedQuestions?: (QuizQuestionPlayerDto | QuizQuestionAuthorDto)[],
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
        categoryId: row.categoryId,
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
      title: row.title,
      description: row.description,
      slug: row.slug,
      requirements: row.requirements,
      imageUrl: row.imageUrl,
      categoryId: row.categoryId,
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
      categoryId: full.categoryId,
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
