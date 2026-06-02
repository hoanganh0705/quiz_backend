/**
 * Quiz Existence Adapter
 *
 * Implements QuizExistencePort by querying the quizzes table directly.
 */

import { Inject, Injectable } from '@nestjs/common';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports/quiz-repository.port';
import type { QuizRepositoryPort } from '@/modules/quiz/domain/ports/quiz-repository.port';
import { type QuizExistencePort } from '../../domain/ports/quiz-existence.port';

@Injectable()
export class QuizExistenceAdapter implements QuizExistencePort {
  constructor(
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: QuizRepositoryPort,
  ) {}

  async exists(quizId: string): Promise<boolean> {
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);
    return quiz !== null;
  }
}
