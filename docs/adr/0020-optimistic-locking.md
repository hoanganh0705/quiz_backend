# ADR-0020 — Optimistic Locking on Quiz Instances

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-08-19 |

## Context

A quiz *instance* is a real-time game room where players join,
answer questions, and the host starts/stops the round. The state
machine moves through `open → running → closed → finished`, and
concurrent operations on the same instance are routine:

- A player joins while the host presses "start".
- Two players submit their final answer at the same instant.
- The host closes the room at the same time the players finish.

The naïve approach reads the row, mutates it in memory, and writes
it back:

```ts
const instance = await db.select().from(quizInstances).where(eq(id, instanceId));
instance.status = 'running';
await db.update(quizInstances).set(instance).where(eq(id, instanceId));
```

Two concurrent transitions both read `status = 'open'`, both decide
to set `status = 'running'`, and both succeed — the *loser* of the
race silently overwrites the winner. This is the classic
**lost-update** problem.

A pessimistic `SELECT FOR UPDATE` works, but it requires every
mutation to take a row-level lock, which serializes any workload
that touches the same row. For an interactive game room with
multiple players per second, that becomes a hot row.

## Decision

We adopt **optimistic locking** with a monotonic version column.
Every `quiz_instances` row carries `version int NOT NULL DEFAULT 1`.
Updates are conditional on the version the writer observed:

```sql
UPDATE quiz_instances
   SET status = 'running',
       version = version + 1
 WHERE instance_id = $1
   AND version = $2
   AND status = 'open';
RETURNING version;
```

If the `UPDATE` returns zero rows, the writer knows the row has
moved underneath it and either retries with a fresh snapshot or
surfaces a conflict error to the caller.

The application-layer helper lives in
`quiz-instance.repository.ts#updateWithVersion(...)`. The instance
state-machine code calls it with `(currentVersion, transitions)`;
the helper returns the new version or throws
`InstanceOptimisticLockError`.

### When optimistic locking is enough

- The mutation count is low (one or two per instance per second).
- The work between read and write is short (validation, status
  flip, event emission).
- The cost of a retry is small — a `select → update` roundtrip is
  sub-millisecond against the local Postgres.

### When optimistic locking is not enough

- High-write hot rows (e.g. ranking counters that every player
  writes to). For those, we use *atomic increments* (`UPDATE … SET
  score = score + 1`) and accept the last-writer-wins on a
  derived aggregate.
- Mutations that span multiple rows where cross-row consistency
  matters — those go through a single `db.transaction` (see
  ADR-0019).

## Consequences

### Positive

- **No row locks held.** Concurrent mutations on the same row
  serialize only at commit time, when Postgres's MVCC has already
  done most of the work.
- **Self-documenting failure.** A `version` mismatch produces a
  visible error (`InstanceOptimisticLockError`), which surfaces as
  a `409 Conflict` to the client. The client knows to retry — or,
  in the case of a state-machine violation, that their action is
  no longer valid.
- **Race-condition testable in isolation.** The
  `quiz-instance.repository.race.spec.ts` unit test simulates the
  race against an in-memory executor with a `FOR UPDATE`-style
  lock; the integration scaffold in
  `test/instance-concurrent-join.e2e-spec.ts` documents the
  full-Postgres recipe for when the integration harness is wired
  up.

### Negative

- **Retry loop required.** Every caller that can race must handle
  the conflict error. We've kept that footprint small by routing
  the conflict through the repository's helper, but it is one
  more branch per state-machine step.
- **Read-modify-write cost.** The transaction reads the row twice
  (once for the version, once for the conditional update). For
  our scale this is negligible; at higher scale it would benefit
  from a `RETURNING *` projection.

## Alternatives considered

- **Pessimistic locking (`SELECT FOR UPDATE`).** Rejected for the
  hot-row case: a multi-second start-time delay while one writer
  waits for another's transaction to commit is unacceptable for a
  real-time game.
- **Explicit `serializable` isolation level.** Considered. Rejected
  because Postgres's serializable isolation is overkill for
  mutations on a single row and adds serialization-failure
  handling on every read.
- **Compare-and-swap in Redis.** Rejected: instance state is the
  database's job. The cache holds snapshots, not the source of
  truth.

## References

- Kleppmann, M. (2017). *Designing Data-Intensive Applications*.
- ADR-0001 — Identifier Strategy.
- ADR-0014 — Event Architecture.
- Source:
  `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts`,
  `src/modules/instance/domain/errors/instance-domain.errors.ts`.