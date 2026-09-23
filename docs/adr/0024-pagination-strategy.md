# ADR-0024: Pagination Strategy — Keyset Cursor as Default

## Status

Accepted — supersedes ADR-0004 for new list endpoints; existing endpoints using cursor pagination remain governed by ADR-0004.

## Context

ADR-0004 established cursor pagination as the default for list endpoints. It described a `(createdAt, id)` tiebreaker sort but did not prescribe an encoding scheme for the sort key itself. Since ADR-0004 was accepted, two additional patterns have emerged that require clarification:

1. **Composite sort columns.** Several endpoints sort by non-timestamp columns (e.g., `score DESC, createdAt ASC, id ASC`). Encoding only `createdAt` and `id` in the cursor is insufficient for stable ordering across composite sorts — inserting a row with an intermediate score causes the cursor to land on the wrong page.

2. **Pagination hygiene.** Offset-based queries (`OFFSET n`) were observed leaking into new endpoints despite the ADR rule. The root cause was ambiguity: the rule said "cursor pagination is the default" but did not name a single utility that endpoints must call, leaving authors to reach for the familiar `skip`/`take` pattern.

We need to tighten the rule to name the exact utility to use, specify that composite cursors must encode all sort columns, and add a lint rule (ADR-0028) to enforce the default.

## Decision

**Encoding rule.** Every cursor encodes the full sort-key tuple of the last row returned, including all columns used in the `ORDER BY` clause. The cursor is a base64url-encoded JSON object. When the sort is `(score DESC, createdAt ASC, id ASC)`, the cursor is `{ score: 85.5, createdAt: "2026-01-15T10:30:00Z", id: "01HX..." }`. Cursors MUST NOT encode only a subset of the sort columns.

**Utility rule.** All list endpoints MUST use `encodeCursor` / `decodeCursor` from `src/common/utils/cursor.util.ts`. The utility accepts a `CursorPayload` (a typed object) and returns the base64url string; it does not accept raw row objects or partial payloads.

**Sort stability rule.** Every cursor-sort query MUST include the primary `id` column as the final sort column (as a tiebreaker after the last business column). Queries that omit the id tiebreaker MUST NOT be used for user-facing pagination.

**Offset is opt-in.** Using `OFFSET` without a cursor is only permitted for admin/debug endpoints. The `@OffsetPagination` DTO type (available in `src/common/responses/pagination.ts`) is the only permitted pattern; raw `skip`/`take` in repository calls is prohibited.

## Consequences

**Advantages**

- Composite cursors are stable regardless of which columns appear in `ORDER BY`.
- Naming the utility makes the rule enforceable: a lint rule that flags any `ORDER BY` without a matching cursor payload immediately identifies violations.
- The id-tiebreaker rule prevents the "insert between pages" duplication problem for all sort shapes.

**Trade-offs**

- Multi-column cursors are larger base64 strings, but the practical size limit is far below URL length limits even for 5-column sorts.
- Existing endpoints that sort by non-timestamp columns (e.g., `ORDER BY score DESC`) need their cursor payloads extended to include `score` — this is a non-breaking DTO change (add a new field) rather than a breaking one.

## Evidence

- `src/common/utils/cursor.util.ts` — `encodeCursor` / `decodeCursor` with `CursorPayload` type.
- `src/modules/tag/mappers/tag-cursor.mapper.ts` — multi-column cursor for `TagCursorMapper` (score + createdAt + tagId).
- `src/modules/coin/dto/response/coin-transactions.dto.ts` — `CoinTransactionsResponseDto` uses `kind: 'cursor'` with full sort-key payload.
- `src/modules/attempt/mappers/attempt-cursor.mapper.ts` — composite cursor for `AttemptCursorMapper` (score + createdAt + attemptId).
- ADR-0004 — the original decision that established cursor as default.
