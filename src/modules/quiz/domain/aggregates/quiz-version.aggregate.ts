/**
 * QuizVersionAggregate — Consistency Boundary
 *
 * This file documents the aggregate boundary for the QuizVersion root entity.
 * It is a documentation artifact — no executable abstractions are introduced here.
 *
 * ---
 *
 * Root Entity: QuizVersion (identified by quizVersionId)
 *
 * Invariants enforced within this boundary:
 *   1. Only one version per quiz may have status='published' at a time
 *   2. Publishing atomically archives the previous published version
 *   3. Only 'draft' versions are mutable (enforced via state machine)
 *   4. A draft version requires MIN_QUESTIONS_TO_PUBLISH questions before publishing
 *   5. versionNumber is auto-incremented per quiz (unique within a quiz)
 *
 * Transactional scope:
 *   - createQuizVersion: creates a new draft version
 *   - createDraftFromSourceVersion: deep-copies source version questions into new draft
 *   - updateQuizVersion: patches draft version metadata
 *   - publishQuizVersionAndSetQuiz: archives old published + publishes new + updates quiz FK
 *
 * Repository: QuizVersionRepositoryPort
 *
 * Dependencies (cross-aggregate references):
 *   - Quiz: owned via quizId FK (QuizAggregate) — quiz is fetched but not modified here
 *   - QuizQuestion: children owned via quizVersionId FK (QuizQuestionAggregate)
 *
 * ---
 *
 * State machine: see quiz-version-state-machine.ts
 *
 * Valid transitions:
 *   - draft → published (via publishQuizVersion)
 *   - published → draft (via updateQuizVersion on published version — creates new draft copy)
 *
 * Key design decisions:
 *   - Versions are immutable once published — edits create new draft copies
 *   - Questions belong to this aggregate (QuizVersion owns question lifecycle)
 *   - Archive is a soft-delete on the version row, not hard-delete
 */
export {};
