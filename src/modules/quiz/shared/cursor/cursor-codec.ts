import type { QuizCursor } from '../../domain/ports/quiz-repository.port';
import type { QuizVersionCursor } from '../../domain/ports/quiz-version-repository.port';
import { QuizValidationError } from '../../domain/errors';
import {
  encodeBase64JsonCursor,
  decodeBase64JsonCursor,
  isIsoDateString,
} from '@/common/utils/cursor.util';

// ---------------------------------------------------------------------------
// Quiz cursor
// ---------------------------------------------------------------------------

export function encodeQuizCursor(cursor: QuizCursor): string {
  return encodeBase64JsonCursor({ createdAt: cursor.createdAt, quizId: cursor.quizId });
}

export function decodeQuizCursor(raw: string): QuizCursor {
  try {
    const parsed = decodeBase64JsonCursor<{ createdAt: unknown; quizId: unknown }>(raw);

    if (!isIsoDateString(parsed.createdAt) || typeof parsed.quizId !== 'string') {
      throw new QuizValidationError('Invalid cursor format');
    }

    return { createdAt: parsed.createdAt, quizId: parsed.quizId };
  } catch (err) {
    if (err instanceof QuizValidationError) throw err;
    throw new QuizValidationError('Invalid cursor format');
  }
}

// ---------------------------------------------------------------------------
// Quiz version cursor
// ---------------------------------------------------------------------------

export function encodeVersionCursor(cursor: QuizVersionCursor): string {
  return encodeBase64JsonCursor({
    createdAt: cursor.createdAt,
    quizVersionId: cursor.quizVersionId,
  });
}

export function decodeVersionCursor(raw: string): QuizVersionCursor {
  try {
    const parsed = decodeBase64JsonCursor<{ createdAt: unknown; quizVersionId: unknown }>(raw);

    if (!isIsoDateString(parsed.createdAt) || typeof parsed.quizVersionId !== 'string') {
      throw new QuizValidationError('Invalid cursor format');
    }

    return { createdAt: parsed.createdAt, quizVersionId: parsed.quizVersionId };
  } catch (err) {
    if (err instanceof QuizValidationError) throw err;
    throw new QuizValidationError('Invalid cursor format');
  }
}
