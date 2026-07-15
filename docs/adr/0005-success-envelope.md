# ADR-0005: Success Response Envelope — Canonical `{ data, meta }`

## Status

Accepted

## Context

Every HTTP response body must have a consistent shape so clients can parse metadata (timestamps, pagination) uniformly without special-casing each endpoint. The envelope also provides a hook for cross-cutting concerns (correlation ID, timestamp injection) without modifying controller logic.

## Decision

**Envelope shape:** All successful responses use:

```
{
  "data": <payload>,
  "meta": {
    "timestamp": "2025-01-15T08:30:00.000Z"
  }
}
```

**For paginated lists:** The `data` field is an array; `meta.pagination` is added alongside `meta.timestamp`:

```
{
  "data": [...],
  "meta": {
    "timestamp": "...",
    "pagination": { "kind": "cursor", "limit": 20, "hasNextPage": true, "nextCursor": "..." }
  }
}
```

**Single producer:** `ResponseFormatInterceptor` (`src/common/interceptors/response-format.interceptor.ts`) wraps every response. Controllers return via presenters that call `ApiResponse.ok()` / `ApiResponse.page()`; the interceptor enforces the envelope for all non-exception paths.

**Bypass conditions:** Responses that are already an `ApiResponseEnvelope`, a `StreamableFile`, or have already sent headers are passed through without re-wrapping.

**Controllers return `ApiResponseEnvelope` via presenters:** Controllers do not return raw objects. Presenters call `ApiResponse.ok(dto)` or `ApiResponse.page(items, pagination)` and return the result. If a controller returns a raw object, the interceptor re-wraps it — which is harmless but not the intended pattern.

**Timestamp normalization:** The interceptor calls `normalizeTemporalFields()` on the envelope before serialization, ensuring all timestamps in the response are ISO 8601 UTC with milliseconds.

## Consequences

**Advantages**
- Clients always know where to find `timestamp` and `pagination` — no per-endpoint documentation needed for the envelope itself.
- The interceptor is a single, auditable place that adds `timestamp` and validates the envelope structure.
- The `isApiResponse()` guard prevents double-wrapping when a presenter or controller already constructs the envelope.

**Trade-offs**
- The envelope adds a level of nesting (`data` → `meta`) to every response. For single-value responses the additional depth is minimal; for large arrays the `data` key is the array itself.
- Presenters must be careful to return `ApiResponseEnvelope` (not a class instance) so the interceptor's `isApiResponse()` guard correctly identifies an already-wrapped response.
- The interceptor's deep traversal for `normalizeTemporalFields()` has a cost on large payloads.

## Evidence

- `src/common/interceptors/response-format.interceptor.ts` — `intercept()` calls `normalizeTemporalFields()` and wraps with `{ data, meta }`.
- `src/common/responses/api-response.ts` — `ApiResponse.ok()`, `ApiResponse.page()`, `isApiResponse()`.
- `src/modules/tag/transport/presenters/tag.presenter.ts` — every presenter method calls `ApiResponse.ok()` or `wrapPaginatedDto()`.
- `src/modules/tag/transport/tag-timestamp.spec.ts` — regression tests asserting the full envelope for every presenter return path.
- `test/envelope.e2e-spec.ts` — end-to-end regression asserting `{ data, meta }` shape on representative endpoints.
- `docs/PROJECT_CONSTITUTION.md` §4.2 — explicitly defines the envelope shape with the `kind` discriminator for pagination.
