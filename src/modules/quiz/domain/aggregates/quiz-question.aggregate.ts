/**
 * QuizQuestionAggregate — Consistency Boundary
 *
 * This file documents the aggregate boundary for the QuizQuestion root entity.
 * It is a documentation artifact — no executable abstractions are introduced here.
 *
 * ---
 *
 * Root Entity: QuizQuestion (identified by questionId)
 *
 * Invariants enforced within this boundary:
 *   1. Position must be unique within a quiz version (enforced at DB level)
 *   2. Each question must have exactly one correct answer option (enforced in service layer)
 *   3. Answer option position must be unique within a question (enforced at DB level)
 *   4. Questions can only be added to draft versions (enforced via QuizVersionPolicy)
 *
 * Transactional scope:
 *   - createQuestionWithOptions: creates question + answer options atomically
 *   - createQuestionsWithOptions: creates multiple questions + all options atomically
 *
 * Repository: QuizQuestionRepositoryPort
 *
 * Dependencies (cross-aggregate references):
 *   - QuizVersion: parent aggregate via quizVersionId FK (QuizVersionAggregate)
 *
 * ---
 *
 * Key design decisions:
 *   - Questions are children of QuizVersion — their lifecycle is tied to the version
 *   - Position is人工 managed — clients decide ordering, repository enforces uniqueness
 *   - Soft-delete is not used for questions — they can be hard-deleted when editing draft
 *   - Correct answer flag: exactly one option per question must have isCorrect=true
 */
export {};
