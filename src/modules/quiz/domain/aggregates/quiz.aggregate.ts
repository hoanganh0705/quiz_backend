/**
 * QuizAggregate — Consistency Boundary
 *
 * This file documents the aggregate boundary for the Quiz root entity.
 * It is a documentation artifact — no executable abstractions are introduced here.
 *
 * ---
 *
 * Root Entity: Quiz (identified by quizId)
 *
 * Invariants enforced within this boundary:
 *   1. slug must be unique across all non-deleted quizzes
 *   2. publishedVersionId points to exactly one QuizVersion with status='published'
 *   3. Soft-delete cascades to all associated versions (enforced via query-level filter)
 *
 * Transactional scope:
 *   - createQuizWithInitialVersion: creates quiz + initial version + category/tag links atomically
 *   - updateQuizWithLinks: updates quiz metadata + replaces category/tag links atomically
 *   - softDeleteQuiz: marks quiz as deleted (versions remain in DB, filtered out at query time)
 *
 * Repository: QuizRepositoryPort
 *
 * Dependencies (cross-aggregate references):
 *   - QuizVersion: owned via publishedVersionId FK (QuizVersionAggregate)
 *   - Category/Tag: many-to-many via quiz_category_links / quiz_tag_links (no aggregate boundary)
 *
 * ---
 *
 * Key design decisions:
 *   - Quiz does NOT own questions — they belong to QuizVersion aggregate
 *   - Slug uniqueness is enforced at the DB level via unique constraint + repository query
 *   - Soft-delete is preferred over hard-delete to preserve referential integrity
 */
export {};
