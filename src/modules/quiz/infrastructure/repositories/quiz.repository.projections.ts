import { QUIZ_COLUMNS, QUIZ_VERSION_COLUMNS } from './quiz.repository.columns';

/**
 * Slim projection for `getActiveQuizRecordById` — only the columns
 * needed for the policy check (creatorId / isHidden / publishedVersionId).
 */
export const QUIZ_RECORD_PROJECTION = {
  quizId: QUIZ_COLUMNS.quizId,
  creatorId: QUIZ_COLUMNS.creatorId,
  isHidden: QUIZ_COLUMNS.isHidden,
  publishedVersionId: QUIZ_COLUMNS.publishedVersionId,
};

/**
 * Full quiz-row-with-published-version projection. Shared across every
 * list / detail read so the column layout is consistent for downstream
 * mappers. Renamed columns (`publishedVersion*`) carry the joined
 * `quiz_versions` row, nullable when the quiz has no published version.
 */
export const QUIZ_WITH_VERSION_PROJECTION = {
  quizId: QUIZ_COLUMNS.quizId,
  creatorId: QUIZ_COLUMNS.creatorId,
  title: QUIZ_COLUMNS.title,
  description: QUIZ_COLUMNS.description,
  slug: QUIZ_COLUMNS.slug,
  requirements: QUIZ_COLUMNS.requirements,
  imageUrl: QUIZ_COLUMNS.imageUrl,
  imagePublicId: QUIZ_COLUMNS.imagePublicId,
  isFeatured: QUIZ_COLUMNS.isFeatured,
  isHidden: QUIZ_COLUMNS.isHidden,
  isVerified: QUIZ_COLUMNS.isVerified,
  publishedVersionId: QUIZ_COLUMNS.publishedVersionId,
  categoryId: QUIZ_COLUMNS.categoryId,
  createdAt: QUIZ_COLUMNS.createdAt,
  updatedAt: QUIZ_COLUMNS.updatedAt,
  publishedVersionQuizVersionId: QUIZ_VERSION_COLUMNS.quizVersionId,
  publishedVersionVersionNumber: QUIZ_VERSION_COLUMNS.versionNumber,
  publishedVersionStatus: QUIZ_VERSION_COLUMNS.status,
  publishedVersionDifficulty: QUIZ_VERSION_COLUMNS.difficulty,
  publishedVersionDurationMs: QUIZ_VERSION_COLUMNS.durationMs,
  publishedVersionPassingScorePercent: QUIZ_VERSION_COLUMNS.passingScorePercent,
  publishedVersionRewardXp: QUIZ_VERSION_COLUMNS.rewardXp,
  publishedVersionCreatedByUserId: QUIZ_VERSION_COLUMNS.createdByUserId,
  publishedVersionCreatedAt: QUIZ_VERSION_COLUMNS.createdAt,
  publishedVersionPublishedAt: QUIZ_VERSION_COLUMNS.publishedAt,
  publishedVersionArchivedAt: QUIZ_VERSION_COLUMNS.archivedAt,
  publishedVersionUpdatedAt: QUIZ_VERSION_COLUMNS.updatedAt,
};
