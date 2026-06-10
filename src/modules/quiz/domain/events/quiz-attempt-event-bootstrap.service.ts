import { Injectable } from '@nestjs/common';
import { QuizAttemptEventHandler } from './quiz-attempt-event-handler.service';

/**
 * Bootstraps event subscriptions from external domains into the Quiz module.
 *
 * Currently subscribes `QuizAttemptEventHandler` to `AttemptCompletedEvent`
 * published by the Attempt module via `AttemptDomainEventBus`.
 *
 * Extensible: add more external → quiz event subscriptions here as the
 * system grows.
 */
@Injectable()
export class QuizAttemptEventBootstrapService {
  constructor(private readonly quizAttemptEventHandler: QuizAttemptEventHandler) {}

  onModuleInit(): void {
    // QuizAttemptEventHandler subscribes itself in onModuleInit.
    // This service exists as a placeholder for future bootstrap logic
    // and to make the subscription dependency explicit in the module.
  }
}
