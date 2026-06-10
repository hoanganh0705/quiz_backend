export const QUIZ_DOMAIN_EVENT_BUS = Symbol('QUIZ_DOMAIN_EVENT_BUS');

export type QuizEventHandler = (event: unknown) => void;

export interface QuizDomainEventBusPort {
  subscribe(handler: QuizEventHandler): () => void;

  emitQuizCreated(event: { quizId: string; creatorId: string; slug: string; nowIso: string }): void;
  emitQuizUpdated(event: { quizId: string; updatedByUserId: string; nowIso: string }): void;
  emitQuizDeleted(event: { quizId: string; deletedByUserId: string; nowIso: string }): void;
  emitQuizVersionCreated(event: {
    quizVersionId: string;
    quizId: string;
    createdByUserId: string;
    versionNumber: number;
    nowIso: string;
  }): void;
  emitQuizVersionPublished(event: {
    quizVersionId: string;
    quizId: string;
    publishedByUserId: string;
    versionNumber: number;
    nowIso: string;
  }): void;
}
