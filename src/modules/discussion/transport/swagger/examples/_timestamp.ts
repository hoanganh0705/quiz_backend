// Shared timestamp constant used by every example payload below.
// Kept distinct from the timestamp emitted at runtime (`now().toISOString()`)
// so OpenAPI consumers can rely on a stable diff and produce golden-file
// tests; the runtime envelope matches the example's shape exactly.
export const EXAMPLE_TIMESTAMP = '2026-07-27T09:25:00.000Z';
