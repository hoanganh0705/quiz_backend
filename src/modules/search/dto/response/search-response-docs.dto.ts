// ─── Search module ───────────────────────────────────────────────────────────
//
// The runtime envelope shape is produced centrally by `ApiOkResource()`:
//   { data: SearchResponseDto, meta: { timestamp } }
//
// This file previously held a hand-rolled `WrappedSearchResponseDto` class.
// It has been deleted as part of the response-envelope migration (Phase 1).
// See docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md §5.3.
