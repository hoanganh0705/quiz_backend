import { Injectable } from '@nestjs/common';
import { QuizResponseDto } from '../dto/response/quiz-response.dto';
import { QuizVersionResponseDto } from '../dto/response/quiz-version-response.dto';
import { QuizQuestionResponseDto } from '../dto/response/quiz-question-response.dto';
import type { QuizWithPublishedVersionRow } from '../domain/ports/quiz-repository.port';

@Injectable()
export class QuizResponseMapper {
  toQuizResponse(
    row: QuizWithPublishedVersionRow,
    publishedQuestions?: QuizQuestionResponseDto[],
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
    };
  }
}
