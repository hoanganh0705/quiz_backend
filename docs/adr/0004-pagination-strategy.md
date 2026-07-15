# ADR-0004: Pagination Strategy — Cursor Pagination for Lists

## Status

Accepted

## Context

All list endpoints in the API need a stable, efficient pagination mechanism. Offset-based pagination (`?page=1`) is expensive on large tables, suffers from drift when rows are inserted or deleted between requests, and leaks row counts to clients. The API needs a strategy that is consistent, performant, and stable across API versions.

## Decision

**Default strategy:** Cursor pagination. Every list endpoint returns `meta.pagination` with `kind: 'cursor'` and the following shape:

```
{
  kind: 'cursor',
  limit: number,
  hasNextPage: boolean,
  nextCursor: string | null
}
```

**Cursor encoding:** Cursors are base64url-encoded JSON objects containing the sort-key tuple of the last row: `{ createdAt: ISO8601, id: UUIDv7 }`. `encodeCursor()` and `decodeCursor()` in `src/common/utils/cursor.util.ts` handle encoding. Cursors MUST NOT contain raw database row IDs or internal state.

**Offset pagination:** Offset is reserved for endpoints without a stable natural sort key (e.g. audit log search, admin user listing). Offset responses use `kind: 'offset'` with `{ kind: 'offset', page, limit, total, hasMore }`.

**Page size:** Default `limit` is 20. Maximum `limit` is enforced per-endpoint via `@Max()` on the query DTO (typically 100). The default MUST NOT change without a deprecation cycle.

**Empty pages:** An empty result returns `data: []` with `hasNextPage: false` and the `meta.pagination` block still present. `data` is never `null`.

**Sorting:** Cursor pagination requires a stable sort key. The canonical sort is `(createdAt ASC, id ASC)` — the `createdAt` from the row and the row's `id` as a tiebreaker. No list endpoint uses `(id)` alone as the cursor because ID generation order and creation time can diverge.

## Consequences

**Advantages**
- Cursor pagination is stable: inserting rows between pages does not cause a row to be skipped or duplicated.
- Cursor pages are O(1) — no `COUNT(*)` required. Performance is consistent regardless of result set size.
- The `(createdAt, id)` tiebreaker is deterministic: two rows created at the same millisecond are ordered by ID.
- The `kind` discriminator lets clients handle both pagination styles without guessing.

**Trade-offs**
- Clients cannot jump to an arbitrary page; they must follow the cursor.
- Bidirectional navigation (previous/next) requires two cursor queries (forward + reverse sort).
- Offset pagination leaks the total count, which may not be desirable for large collections.
- Cursors are opaque to clients; they must not be parsed or constructed manually.

## Evidence

- `src/common/responses/pagination.ts` — `CursorPagination` and `OffsetPagination` discriminated union types.
- `src/common/utils/cursor.util.ts` — `encodeCursor()` / `decodeCursor()` with base64url encoding.
- `src/modules/tag/dto/request/tag-ranking-query.dto.ts` — `@Min(1) @Max(100) limit = 20`.
- `src/modules/tag/infrastructure/repositories/tag.repository.ts` — `getRankedTags` uses `asc(tags.createdAt), asc(tags.id)` as sort key.
- `src/modules/tag/mappers/tag-cursor.mapper.ts` — `TagCursorMapper.serialize()` encodes `{ createdAt, tagId }`.
- `src/modules/tag/transport/presenters/tag.presenter.ts` — `wrapPaginatedDto` places `nextCursor` in `meta.pagination`.
- `src/modules/tag/transport/swagger/examples/tag.examples.ts` — cursor examples with `kind: 'cursor'`.
- `docs/PROJECT_CONSTITUTION.md` §4.5 — explicitly locks cursor pagination as the default for large/unbounded lists.
