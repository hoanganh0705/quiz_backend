import type { QuizCursor } from '../../domain/ports/quiz-repository.port';
import type { QuizVersionCursor } from '../../domain/ports/quiz-version-repository.port';

function encode<T>(value: T): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode<T>(cursor: string): T {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
}

export function encodeQuizCursor(cursor: QuizCursor): string {
  return encode(cursor);
}

export function decodeQuizCursor(cursor: string): QuizCursor {
  return decode<QuizCursor>(cursor);
}

export function encodeVersionCursor(cursor: QuizVersionCursor): string {
  return encode(cursor);
}

export function decodeVersionCursor(cursor: string): QuizVersionCursor {
  return decode<QuizVersionCursor>(cursor);
}
