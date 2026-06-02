/**
 * Quiz Existence Adapter
 *
 * Implements QuizExistencePort by querying the quizzes table directly.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizzes } from '@/core/database/schema';
import { QUIZ_EXISTENCE_PORT, type QuizExistencePort } from '../../domain/ports/quiz-existence.port';
import { eq, and, isNull, count } from 'drizzle-orm';

@Injectable()
export class QuizExistenceAdapter implements QuizExistencePort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async exists(quizId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ count: count() })
      .from(quizzes)
      .where(and(eq(quizzes.quizId, quizId), isNull(quizzes.deletedAt)));
    return Number(row?.count ?? 0) > 0;
  }
}
