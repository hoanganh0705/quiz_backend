import type { QuizCursor } from '../domain/ports/quiz-repository.port';
import type { QuizVersionCursor } from '../domain/ports/quiz-version-repository.port';
import {
  encodeQuizCursor,
  decodeQuizCursor,
  encodeVersionCursor,
  decodeVersionCursor,
} from '../shared/cursor/cursor-codec';

export class QuizCursorMapper {
  static parse(cursor: string): QuizCursor {
    return decodeQuizCursor(cursor);
  }

  static serialize(cursor: QuizCursor): string {
    return encodeQuizCursor(cursor);
  }
}

export class QuizVersionCursorMapper {
  static parse(cursor: string): QuizVersionCursor {
    return decodeVersionCursor(cursor);
  }

  static serialize(cursor: QuizVersionCursor): string {
    return encodeVersionCursor(cursor);
  }
}
