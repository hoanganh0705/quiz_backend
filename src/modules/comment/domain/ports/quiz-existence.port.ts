/**
 * Quiz Existence Port
 *
 * Interface for checking quiz existence.
 * Allows Comment domain to validate quiz IDs without depending on Quiz module implementation.
 */

export interface QuizExistencePort {
  /**
   * Check if a quiz exists and is not deleted.
   * @param quizId - UUID of the quiz to check
   */
  exists(quizId: string): Promise<boolean>;
}

export const QUIZ_EXISTENCE_PORT = Symbol('QUIZ_EXISTENCE_PORT');
