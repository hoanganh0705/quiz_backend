import { QuizValidationError } from '../errors';
import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
  isStringMatchingPattern,
} from '@/common/utils/cursor.util';
import { normalizeSlugOrThrow } from '@/common/utils/slug.util';
import type { QuizCursorPayload, QuizVersionCursorPayload } from '../../types/quiz.types';
import { QUIZ_SLUG_EMPTY_MESSAGE, QUIZ_SLUG_INVALID_MESSAGE } from '../../quiz.constants';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const decodeQuizCursor = (cursor: string): QuizCursorPayload => {
  const parsed = decodeBase64JsonCursor<QuizCursorPayload>(cursor);

  if (!isIsoDateString(parsed.createdAt) || !isStringMatchingPattern(parsed.quizId, UUID_PATTERN)) {
    throw new QuizValidationError('Invalid cursor');
  }

  return {
    createdAt: parsed.createdAt,
    quizId: parsed.quizId,
  };
};

export const decodeQuizVersionCursor = (cursor: string): QuizVersionCursorPayload => {
  const parsed = decodeBase64JsonCursor<QuizVersionCursorPayload>(cursor);

  if (
    !isIsoDateString(parsed.createdAt) ||
    !isStringMatchingPattern(parsed.quizVersionId, UUID_PATTERN)
  ) {
    throw new QuizValidationError('Invalid cursor');
  }

  return {
    createdAt: parsed.createdAt,
    quizVersionId: parsed.quizVersionId,
  };
};

export const encodeQuizCursor = (quiz: { createdAt: string; quizId: string }): string =>
  encodeBase64JsonCursor({ createdAt: quiz.createdAt, quizId: quiz.quizId });

export const encodeQuizVersionCursor = (version: {
  createdAt: string;
  quizVersionId: string;
}): string =>
  encodeBase64JsonCursor({
    createdAt: version.createdAt,
    quizVersionId: version.quizVersionId,
  });

export const normalizeQuizSlug = (slug: string): string =>
  normalizeSlugOrThrow(slug, {
    emptyMessage: QUIZ_SLUG_EMPTY_MESSAGE,
    invalidMessage: QUIZ_SLUG_INVALID_MESSAGE,
  });

export const normalizeLinkIds = (values?: string[]): string[] => {
  if (!values || values.length === 0) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()))];
};
