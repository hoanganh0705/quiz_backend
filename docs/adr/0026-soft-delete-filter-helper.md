# ADR-0026: Soft-Delete Filter Helper — `notDeleted()`

## Status

Accepted

## Context

Soft-deletable tables in this codebase use a `deleted_at` column of type `timestamp with time zone` (nullable). Every query that reads from a soft-deletable table must filter `WHERE deleted_at IS NULL` to exclude deleted rows. The codebase has historically placed this filter inline in each repository method, which creates three risks:

1. **Omission.** An author writing a new query can forget to add the filter, returning deleted rows to callers. The risk is silent: tests pass with seeded data that has no `deleted_at` values.
2. **Inconsistency.** Two authors may implement the filter slightly differently (e.g., `isNull(deletedAt)` vs. `eq(deletedAt, null)` — the latter is wrong in PostgreSQL). A shared helper enforces a single correct expression.
3. **Duplication.** The same `and(eq(t.deletedAt, null), ...)` expression appears in dozens of repository files. Moving the table renames the column, requiring edits in N places.

We need a single, auditable helper that all repositories must use.

## Decision

**The `notDeleted()` helper.** Every soft-deletable table has a `deletedAt` column. A `notDeleted(table)` function is defined once per repository (in a `soft-delete.ts` or equivalent alongside the table definition) and produces the correct `SQL` filter expression. Repositories MUST use this helper for every `SELECT` against a soft-deletable table.

**Location.** The helper lives in the repository file that owns the aggregate, not in a shared utility. This keeps the table reference close to the repository that uses it. A table referenced by multiple repositories (e.g., `users` referenced by `tag`, `quiz`, and `coin` repositories) must have the helper defined in each repository that uses it.

**Return type.** `notDeleted()` returns `SQL | undefined` so callers can use it in `and(...)` chains without null-safety issues:

```typescript
// correct
const filter = and(notDeleted(users), eq(users.role, 'admin'));

// handles the case where notDeleted returns undefined (no soft-delete column)
```

**Enforcement.** A lint rule (`no-soft-delete-leak`, implemented in `tools/eslint-plugins/`) flags any `where()` clause in a `*.repository.ts` file that does not contain `notDeleted` when the queried table has a `deletedAt` column. The rule runs in CI and blocks merges.

**Migrations.** New soft-deletable tables MUST add a `deletedAt` column in the same migration as the table definition. Backfilling deleted rows (setting `deleted_at = now()` for existing rows) is the default; leaving deleted rows with `NULL` is only permitted when the table has never had deletions.

## Consequences

**Advantages**

- Single source of truth for the soft-delete predicate — renaming `deletedAt` requires editing one line per repository.
- The lint rule makes omission a build failure rather than a silent runtime bug.
- The helper can be extended to handle `OR deleted_at < :retention_cutoff` for GDPR erasure workflows without touching individual repository methods.

**Trade-offs**

- Adding the helper to every repository is a one-time migration cost. Existing repository files must be updated when this ADR is adopted.
- The lint rule requires a table-metadata registry (mapping table names to whether they are soft-deletable) that must be kept in sync with schema changes.

## Evidence

- `src/common/database/soft-delete.helper.ts` — the `notDeleted()` helper implementation.
- `src/modules/tag/infrastructure/repositories/tag.repository.ts` — canonical usage of `notDeleted(tags)`.
- `src/core/database/schema/` — all tables that carry `deletedAt: timestamp('deleted_at')`.
- `tools/eslint-plugins/no-soft-delete-leak.ts` — the lint rule (ADR-0028).
- `ADR-0011` — the original soft-delete decision.
- `ADR-0007` — the repository pattern that this ADR extends.
