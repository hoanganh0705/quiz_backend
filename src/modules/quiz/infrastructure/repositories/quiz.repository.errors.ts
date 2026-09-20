import {
  isPostgresUniqueViolation,
  isPostgresForeignKeyViolation,
} from '@/common/utils/db-error.util';
import {
  QuizOperationFailedError,
  QuizSlugConflictError,
  QuizValidationError,
} from '@/modules/quiz/domain/errors';
import {
  QUIZ_LINK_IDS_INVALID_MESSAGE,
  QUIZ_SLUG_CONFLICT_MESSAGE,
} from '@/modules/quiz/quiz.constants';

/**
 * Maps raw PostgreSQL errors thrown by `createQuizWithInitialVersion`
 * into the typed domain-error hierarchy the application layer knows how
 * to handle.
 */
export function mapQuizCreateError(error: unknown): never {
  if (isPostgresUniqueViolation(error)) {
    throw new QuizSlugConflictError(QUIZ_SLUG_CONFLICT_MESSAGE);
  }

  if (isPostgresForeignKeyViolation(error)) {
    throw new QuizValidationError(QUIZ_LINK_IDS_INVALID_MESSAGE);
  }

  throw new QuizOperationFailedError('Quiz operation failed');
}

/**
 * Same mapping as `mapQuizCreateError`, used by `updateQuizWithLinks`.
 * Both share the slug-unicity / FK-violation classification but kept
 * separate to leave room for future divergence (e.g. an "update"
 * specific conflict class) without churn at the call-sites.
 */
export function mapQuizUpdateError(error: unknown): never {
  if (isPostgresUniqueViolation(error)) {
    throw new QuizSlugConflictError(QUIZ_SLUG_CONFLICT_MESSAGE);
  }

  if (isPostgresForeignKeyViolation(error)) {
    throw new QuizValidationError(QUIZ_LINK_IDS_INVALID_MESSAGE);
  }

  throw new QuizOperationFailedError('Quiz operation failed');
}
