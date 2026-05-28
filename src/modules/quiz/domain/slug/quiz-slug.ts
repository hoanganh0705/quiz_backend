import { QuizValidationError } from '../errors';
import { QUIZ_SLUG_EMPTY_MESSAGE, QUIZ_SLUG_INVALID_MESSAGE } from '../../quiz.constants';

/**
 * Domain invariant: quiz slugs must be lowercase, non-empty, and contain only
 * letters, numbers, and hyphens (e.g. "intro-to-sql", "js-101").
 *
 * This rule belongs to the Quiz aggregate. Any path that creates or modifies
 * a quiz slug MUST pass through this function before persisting.
 */
const QUIZ_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeQuizSlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();

  if (trimmed.length === 0) {
    throw new QuizValidationError(QUIZ_SLUG_EMPTY_MESSAGE);
  }

  if (!QUIZ_SLUG_PATTERN.test(trimmed)) {
    throw new QuizValidationError(QUIZ_SLUG_INVALID_MESSAGE);
  }

  return trimmed;
}
