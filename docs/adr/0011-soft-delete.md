# ADR-0011: Soft Delete Strategy — DeletedAt Timestamp + Partial Unique Indexes

## Status

Accepted

## Context

The system must support reversible data deletion for entities that are referenced by other entities (users in friendships, quizzes in attempts, tags in tag-follows). Physical deletion would either break referential integrity or require cascading deletes that lose audit history. The system also needs to enforce uniqueness constraints (e.g. a slug per category) that apply only to active records.

## Decision

**Deletion mechanism:** Every table that supports soft delete has a `deletedAt timestamp with time zone` column (nullable). An active record has `deletedAt = NULL`. A deleted record has `deletedAt = <ISO 8601 UTC timestamp>`.

**Read filters:** All repository queries that fetch "active" records add `WHERE deletedAt IS NULL` as the first filter condition. This pattern is applied consistently across all repositories, including sub-queries and JOINs.

**Restore:** Soft-deleted records can be restored by setting `deletedAt = NULL`. Repositories expose a `restore(id)` method for this.

**Partial unique indexes:** Uniqueness constraints (e.g. slug per active category) use partial indexes: `CREATE UNIQUE INDEX ... WHERE deletedAt IS NULL`. This allows a slug to be "freed" when a record is deleted, without modifying the deleted record, and allows a new record with the same slug to be created.

**Cascade behavior:** When a soft-deletable entity (e.g. a tag) is deleted, related entities (e.g. tag-follow records) may be soft-deleted or retained depending on the business rule:
- Tags are soft-deleted; tag-follows reference the tagId but do not cascade-delete (queries filter by `isNull(deletedAt)` on both sides).
- Users are soft-deleted atomically with session revocation via a single transaction (`softDeleteAccount` in `UserRepositoryPort`).

**Hard delete:** Explicitly disallowed by current business rules. No endpoint or repository method performs a physical `DELETE`. Audit logs and achievement records retain historical data.

## Consequences

**Advantages**
- No referential integrity breakage — foreign keys remain valid.
- Partial unique indexes allow slug reuse without schema changes.
- Restore capability is a single `UPDATE SET deletedAt = NULL`, no data loss.
- Audit history is preserved; deleted records remain queryable for compliance.
- The `isNull(deletedAt)` filter is consistent and predictable across all modules.

**Trade-offs**
- Queries must always include `deletedAt IS NULL`; forgetting this filter is a bug that is not caught by the compiler. Tests exist to assert this pattern, but it is not enforced mechanically.
- `deletedAt` column clutters the schema and every entity type.
- Soft-deleted records still occupy storage and bloat indexes (though `deletedAt IS NULL` predicates can use partial indexes efficiently).
- Restoration of a record with many relationships requires careful consideration of which relationships should also be restored.

## Evidence

- `src/core/database/schema/taxonomy/schema.ts` — every table definition includes `deletedAt: timestamp('deleted_at')` with `nullable()`.
- `src/modules/category/infrastructure/repositories/category.repository.ts` — `softDelete` sets `deletedAt = nowIso`; `restore` sets `deletedAt = null`.
- `src/modules/category/infrastructure/repositories/category.repository.ts` — `getBySlug` filters `isNull(categories.deletedAt)` and JOINs to quizzes filtering `isNull(QUIZ_COLUMNS.deletedAt)`.
- `src/modules/social/infrastructure/repositories/social.repository.ts` — friendship and user-follow reads always filter `deletedAt IS NULL`.
- `src/modules/auth/domain/ports/user-repository.port.ts` — `softDeleteAccount` atomically soft-deletes the user and revokes all sessions in one transaction.
- `src/modules/quiz/infrastructure/repositories/quiz.repository.ts` — `softDeleteQuiz` sets `deletedAt`.
- `src/modules/quiz/domain/quiz/quiz-command.service.ts` — `softDeleteQuizById` calls repository `softDeleteQuiz`.
- `src/modules/tag/domain/ports/tag-repository.port.ts` — `softDelete` returns `Promise<boolean>`.
- `src/modules/tag/domain/tag.service.ts` — `deleteTag` and `restoreTag` flow.
- `docs/PROJECT_CONSTITUTION.md` §5.3 — soft delete as the mandatory deletion policy.
- `docs/architecture/persistence-flow.md` — soft delete strategy with partial unique index diagram.
