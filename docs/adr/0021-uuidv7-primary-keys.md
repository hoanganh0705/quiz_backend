# ADR-0021 — UUIDv7 for All Primary Keys

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-08-19 |
| Amends    | ADR-0001 (Identifier Strategy) |

## Context

ADR-0001 establishes that "all primary keys use UUIDv7." This ADR
spells out the operational rationale and the migration story that
ADR-0001 took as a given.

Every primary key in the quiz backend must be:

1. **Globally unique.** Multi-region replicas and downstream
   consumers (notifications, coins) ingest events without
   coordination.
2. **Time-ordered.** Audit and debug queries ask "give me the
   rows from the last hour" — a sequential scan on an unordered
   primary-key index is slow, while a time-ordered index is a
   straight read.
3. **Client-generated where useful.** Some endpoints (anonymous
   quiz attempts) accept a client-supplied id; we want a format
   that the client can generate without coordinating with the
   server.
4. **URL-safe.** Public ids land in URLs (`/quizzes/<id>`,
   `/users/<id>/profile-bundle`). Hyphenated hex is the standard.

The two dominant choices were UUIDv4 (pure randomness) and UUIDv7
(time-ordered). UUIDv1 (timestamp + MAC address) leaks hardware
information and is unsuitable for public ids. UUIDv6 is a draft
with limited library support.

## Decision

We use **UUIDv7** for every primary key. UUIDv7 is the RFC 9562
revision that places a millisecond-precision timestamp in the
leading 48 bits, followed by random bits:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
├─┴─┴─┴─┴─┴─┴─┴─┴─┼─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┼─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┤
|unix_ts_ms (48)  |ver(4)|  rand_a (12)   |var(2)| rand_b (62)      |
```

The Postgres schema uses Drizzle's `default(sql\`uuidv7()\`)`, so
the database assigns the id at INSERT time. Application code that
needs to generate a client-side id uses `crypto.randomUUID()` plus
a millisecond-precise timestamp prefix from the standard library.

### Indexing

Because UUIDv7 ids are time-ordered, a B-tree index on the primary
key is also a roughly time-ordered index. The query

```sql
SELECT * FROM quiz_instances
 WHERE created_at > now() - interval '1 hour'
 ORDER BY created_at DESC
 LIMIT 50;
```

uses a sequential index range scan, not a heap scan + sort. This
matters most on the high-write tables (`quiz_instances`,
`attempt_answers`, `quiz_instance_players`).

### Migration story

All tables created since 2026-08-19 default to UUIDv7. Tables
predating the migration use UUIDv4; we have not backfilled them
because the indexes are still B-trees and the performance
characteristic at our scale is dominated by the access pattern
(filter + sort), not the index density. A backfill is a
follow-up item if it ever becomes a bottleneck.

## Consequences

### Positive

- **Time-ordered primary keys.** `created_at` queries are fast
  without a separate composite index on `(created_at)`.
- **RFC 9562 standard.** Tooling (Postgres, Drizzle, Node.js's
  `crypto.randomUUID` since v19) all speak UUIDv7.
- **No MAC-address leak.** Unlike UUIDv1, UUIDv7 reveals only the
  timestamp.
- **Cross-region safety.** A row inserted in `us-east-1` has the
  same id shape as one in `ap-southeast-1`; conflict-free
  ingestion requires only the timestamp's monotonicity at the
  producer.

### Negative

- **Timestamp leak.** The high bits encode `unix_ts_ms`, which
  reveals when the row was created. For the quiz backend this is
  acceptable (the `created_at` column exposes the same value), but
  it is worth flagging if the data ever becomes sensitive.
- **Migration friction.** Rows created with UUIDv4 still exist;
  consumers that depend on monotonic id ordering will see gaps.
  We accept this trade-off rather than rewriting history.
- **Library availability.** Some Node.js libraries only learned
  UUIDv7 in 2024. We pinned `uuid@9+` and used Drizzle's SQL
  helper on the database side, which sidesteps any client-side
  gap.

## Alternatives considered

- **Auto-incrementing integers (`bigserial`).** Rejected: the
  sequence becomes a coordination bottleneck across replicas and
  leaks row counts in URLs.
- **UUIDv4.** Rejected: high-cardinality indexes are random; an
  insert-heavy workload fans out across the B-tree and degrades
  page locality.
- **UUIDv1 (timestamp + MAC).** Rejected: leaks the server's MAC
  address, which has historically been considered a privacy
  hazard.
- **ULID.** Considered. The format is equivalent to UUIDv7 in
  properties; we chose UUIDv7 because the standard library and
  Postgres both speak it natively.

## References

- RFC 9562 — Universally Unique IDentifiers (UUID).
- ADR-0001 — Identifier Strategy.
- Source: `src/core/database/schema/`, Drizzle `uuidv7()` helper.