# Round Lifecycle Automation — Implementation Plan

> Status: **Plan, not yet implemented.** This plan supersedes an earlier draft that proposed a separate `RoundLifecycleService`, `RoundSchedulerService`, outbox events, and notification handlers. After an architecture review against the actual codebase, that draft was rejected as over-engineered. This plan follows the simpler path.

---

## Goal

Make round status transitions (`pending → open → finished`) automatic and time-driven, mirroring the existing tournament-lifecycle plumbing. After delivery, no operator should need to modify the database to move a round.

**The state transition is the entire feature.** There is no downstream consumer waiting for events today, so the implementation should be the minimum that flips a column.

---

## Final Architecture Decisions

| # | Decision | Value |
|---|---|---|
| D1 | State machine | `pending → open → finished` (3 states) |
| D2 | Lifecycle service | **Extend `TournamentLifecycleService`** — add 2 methods |
| D3 | Scheduler | **Extend `TournamentSchedulerService`** — add 2 `@Cron` methods |
| D4 | Transition driver | `round.startAt` and `round.endAt` |
| D5 | Cron cadence | every minute for both `openDueRounds` and `closeDueRounds` |
| D6 | Concurrency | Redis advisory lock per job (mirrors `tournament:cron:tournament-start`) |
| D7 | Repository additions | 3 methods on existing `TournamentRepositoryPort` |
| D8 | Atomicity | Each transition is a single guarded UPDATE; no transaction wrapper needed |
| D9 | Outbox events | **None.** No consumer exists. |
| D10 | Notifications | **None.** No product requirement documented. |
| D11 | Feature flag | **None.** Consistent with existing cron jobs. |

---

## Why No New Services

The earlier draft proposed `RoundLifecycleService` (new) and `RoundSchedulerService` (new) as parallel siblings to `TournamentLifecycleService` and `TournamentSchedulerService`. After reviewing the codebase:

- `TournamentLifecycleService` is the single owner of tournament-module state transitions. Three public methods (`dispatchStartingSoonNotifications`, `startDueTournaments`, `finalizeDueTournaments`) all share the same shape: list-due → guard-update → log. Round transitions are the same shape.
- `TournamentSchedulerService` already owns 4 cron jobs spanning tournament registration, start, finalize, and participant-totals reconciliation. They are not all the same aggregate; they are the same *module's* cron jobs. Round transitions belong to the same module.
- Splitting round logic into a new file creates an artificial separation: a future maintainer would look in two places for the round transition logic.

**Decision:** add 2 methods to each existing class. No new files for lifecycle or scheduler logic.

---

## Why No Outbox Events

The earlier draft proposed `tournament.round.opened` and `tournament.round.closed` events flowing through the transactional outbox.

**Evidence the codebase has no consumer for these:**

- `tournament-outbox-processor.service.ts` deserializes 5 event types: `tournament.joined`, `tournament.participant.withdrawn`, `tournament.starting_soon`, `tournament.completed`, `tournament.won`. No round event types.
- `TournamentListenerAdapter` subscribes to 4 event types. No round event types.
- A workspace-wide search for `round-opened`, `round-closed`, and `round\.opened`/`round\.closed` returns zero matches.

The outbox pattern exists to solve a specific problem: events with downstream consumers, where the consumer's processing must survive a process crash between business write and event dispatch. Without consumers, the pattern pays cost without delivering value.

**Decision:** The state transition is the entire event. Any future consumer reads `round.status` from the database.

---

## Why No Notifications

The earlier draft proposed a notification handler that fans out to all active participants on `round.opened`.

**Evidence the codebase has no product requirement for this:**

- Zero code references round-opened notifications.
- The existing `tournament.starting_soon` notification exists because "tournament is about to start, register now" is a user-facing product moment. Round-open is not analogous — the round becomes playable for participants who are already enrolled.
- No product doc or ticket surfaces this requirement.

**Decision:** Ship without notifications. If product asks for it later, the simplest path is to extend `dispatchStartingSoonNotifications` to also dispatch `round.opened` events. The participant iteration pattern is already there.

---

## State Machine

```
Pending (status = pending)
    ↓ openDueRounds — cron every minute, when now >= round.startAt AND tournament.status = ongoing
Open (status = open)
    ↓ closeDueRounds — cron every minute, when now >= round.endAt
Finished (status = finished)
```

### Transition Rules

**`pending → open`**

Conditions (ALL must hold):

- `now >= round.startAt`
- `round.startAt IS NOT NULL`
- `tournament.status = 'ongoing'`
- `tournament.deletedAt IS NULL`

If `round.startAt IS NULL` the round never auto-opens (caller's choice for one-off tournaments).

**`open → finished`**

Conditions (ALL must hold):

- `now >= round.endAt`
- `round.endAt IS NOT NULL`

The tournament-status check is intentionally NOT required for close: a round whose tournament transitioned `ongoing → finished` mid-round still closes by its own `endAt`.

**Rejected state:** `running` is dropped from `TournamentRoundStatus`. It is currently declared but never written. Unused enum values erode model integrity.

---

## File-Level Change Map

| Layer | File | Action | Approx. LoC |
|---|---|---|---|
| Types | `src/modules/tournament/types/tournament.types.ts` | Drop `'running'` from `TOURNAMENT_ROUND_STATUSES` and the type alias | -1 |
| DTO | `src/modules/tournament/dto/response/tournament-round-response.dto.ts` | Verify (auto-rebuilds from constants) | 0 |
| Repository port | `src/modules/tournament/domain/ports/tournament-repository.port.ts` | Add 3 methods | +20 |
| Repository impl | `src/modules/tournament/infrastructure/repositories/tournament.repository.ts` | Implement 3 methods | +60 |
| Lifecycle service | `src/modules/tournament/domain/tournament-lifecycle.service.ts` | Add `openDueRounds` and `closeDueRounds` | +60 |
| Scheduler | `src/modules/tournament/infrastructure/scheduler/tournament-scheduler.service.ts` | Add 2 `@Cron` methods, 2 `LOCK_TTL_MS` entries | +80 |
| Module | `src/modules/tournament/tournament.module.ts` | Verify (no wiring change expected) | 0 |
| Tests | 3 spec files + 1 integration test | Add / extend | +300 |
| Docs | `docs/modules/tournament.md` | Add round state machine to Lifecycle section | +20 |

**Total surface:** ~200 lines net new code. **Zero new abstractions.** No new files.

---

## Phase 1 — Enum Cleanup

**Why:** The `running` state is declared but never written. Leaving it produces an invariant violation (declared state, unreachable in practice).

**Files:** `tournament.types.ts`, `tournament-round-response.dto.ts`, `tournament.seed.ts` (verify).

**Change:** Remove `'running'` from `TOURNAMENT_ROUND_STATUSES` and from the `TournamentRoundStatus` type alias.

**Priority:** P0 &nbsp;&nbsp; **Complexity:** XS &nbsp;&nbsp; **Risk:** Low &nbsp;&nbsp; **Breaking:** No (verify `'running'` is unused in production DB before merging — see `docs/round-lifecycle-prechecks.sql.md` Q1).

---

## Phase 2 — Repository Additions

**Files:**

- `src/modules/tournament/domain/ports/tournament-repository.port.ts`
- `src/modules/tournament/infrastructure/repositories/tournament.repository.ts`

**New port methods:**

```ts
listDueRoundOpens({ nowIso, page, limit }): Promise<{ items: TournamentRoundRow[] }>
listDueRoundCloses({ nowIso, page, limit }): Promise<{ items: TournamentRoundRow[] }>
markRoundStatus({
  roundId, fromStatus, toStatus, nowIso, tx?
}): Promise<TournamentRoundRow | null>
```

**Implementation notes:**

- `listDueRoundOpens` — JOIN `tournament_rounds` with `tournaments` on `tournament_id`. Filter `round.status = 'pending' AND round.start_at <= nowIso AND round.start_at IS NOT NULL AND tournament.status = 'ongoing' AND tournament.deleted_at IS NULL`. Order by `round.start_at ASC` (longest-waiting first). Accept `page` / `limit` so the lifecycle service can paginate externally — mirroring `listCompletedTournaments`.
- `listDueRoundCloses` — Filter `round.status = 'open' AND round.end_at <= nowIso AND round.end_at IS NOT NULL`. Order by `round.end_at ASC`. Same pagination.
- `markRoundStatus` — Mirror `markTournamentStatus`: a guarded `UPDATE ... WHERE status = fromStatus`. Returns the post-mutation row, or `null` on no-op. The optional `tx` parameter is reserved for future use (atomicity with downstream writes). Today's lifecycle methods do not need it.

**Priority:** P0 &nbsp;&nbsp; **Complexity:** S &nbsp;&nbsp; **Risk:** Low &nbsp;&nbsp; **Breaking:** No (purely additive).

---

## Phase 3 — Lifecycle Service Methods

**File:** `src/modules/tournament/domain/tournament-lifecycle.service.ts` (existing).

Add two public methods to the existing class. They follow the exact shape of `startDueTournaments` and `finalizeDueTournaments`:

```ts
async openDueRounds(nowIso: string): Promise<number> {
  // Paginate via listDueRoundOpens with PAGE_SIZE = 100 (mirroring finalizeDueTournaments).
  // For each page: for each item, call markRoundStatus({ fromStatus: 'pending', toStatus: 'open' }).
  // Return total transitioned count.
  // Log event: 'rounds_opened' with transitioned count.
}

async closeDueRounds(nowIso: string): Promise<number> {
  // Symmetric to openDueRounds.
  // markRoundStatus({ fromStatus: 'open', toStatus: 'finished' }).
  // Log event: 'rounds_closed' with transitioned count.
}
```

**No transaction wrapper.** Each `markRoundStatus` call is a single guarded UPDATE. The guard `WHERE status = fromStatus` provides the same concurrency safety as the tournament equivalent. If we later need atomicity with a downstream write (e.g., a future notification consumer), we can introduce a transaction without changing these signatures.

**Priority:** P0 &nbsp;&nbsp; **Complexity:** S &nbsp;&nbsp; **Risk:** Low (direct parallel to `startDueTournaments`).

---

## Phase 4 — Scheduler Methods

**File:** `src/modules/tournament/infrastructure/scheduler/tournament-scheduler.service.ts` (existing).

Add two `@Cron` methods following the exact shape of `handleTournamentStart`:

```ts
@Cron('* * * * *')
async handleOpenDueRounds(): Promise<void> {
  // Acquire Redis advisory lock 'tournament:cron:round-open' with TTL 5min.
  // If lock not acquired → log 'tournament_scheduler_skipped_lock_held' and return.
  // Try: call this.lifecycleService.openDueRounds(now).
  // Catch: log 'tournament_scheduler_round_open_failed'.
  // Finally: release lock.
}

@Cron('* * * * *')
async handleCloseDueRounds(): Promise<void> {
  // Symmetric. Lock key 'tournament:cron:round-close'.
}
```

Also extend `LOCK_TTL_MS`:

```ts
ROUND_OPEN: 5 * 60 * 1000,        // 5 minutes
ROUND_CLOSE: 5 * 60 * 1000,       // 5 minutes
```

### Cron cadence — why every minute

A competitive-tournament platform needs user-perceived latency ≤ 60s from `round.startAt` to "Round is now open." Five-minute cadence (used at tournament level) is acceptable for low-frequency transitions but unacceptable for round-open. The query is indexable and bounded so per-minute cost is negligible.

### Per-job batch size

Each call processes up to 100 rounds via external pagination in the lifecycle service. If more are due, the next tick drains the rest. This bounds a single tick's runtime so the lock TTL stays well above worst-case execution time.

**Priority:** P0 &nbsp;&nbsp; **Complexity:** S &nbsp;&nbsp; **Risk:** Low (cron skeleton identical to working tournament scheduler).

---

## Phase 5 — Module Wiring

**File:** `src/modules/tournament/tournament.module.ts`.

**Verify only.** `TournamentLifecycleService` and `TournamentSchedulerService` are already registered in `providers`. No new providers needed; no `app.module.ts` change needed. `ScheduleModule.forRoot()` is already initialized.

If the existing module does not register `TournamentLifecycleService` (because the existing methods were added without module changes), no registration is required for the new methods.

**Priority:** P0 &nbsp;&nbsp; **Complexity:** XS &nbsp;&nbsp; **Risk:** None.

---

## Phase 6 — Tests

### Unit Tests

| File | Coverage |
|---|---|
| `src/modules/tournament/infrastructure/repositories/tournament.repository.spec.ts` (extend) | `markRoundStatus` guard semantics: cannot re-open, cannot mutate out of `finished`, returns `null` on no-op. `listDueRoundOpens` / `listDueRoundCloses` query correctness. |
| `src/modules/tournament/application/tournament-lifecycle.spec.ts` (extend) | `openDueRounds` and `closeDueRounds` happy path, pagination loop terminates correctly, returns count. |
| `src/modules/tournament/infrastructure/scheduler/tournament-scheduler.service.spec.ts` (extend) | Lock-held path skips. Lock-acquired path delegates to lifecycle. Exception path logs and releases lock. |

### Integration Tests

| File | Scenario |
|---|---|
| `test/integration/tournament/round-lifecycle.e2e.spec.ts` (new) | Create ongoing tournament with round having `startAt = NOW - 1min`. Wait one tick. Verify flip to `open`. POST attempt → 201. |
| Same file | Round with `endAt = NOW - 1min`. Verify flip to `finished`. POST attempt → 400 `TournamentRoundNotOpenError`. |
| Same file | `tournament.status = 'finished'`. Verify round stays `pending` even if `startAt` in the past. |
| Same file | Two `TournamentSchedulerService` instances in-process. Verify only one acquires the lock per tick. |

### Edge Cases to Cover

1. Round with both `startAt` and `endAt` already in the past at the moment of the open-tick — verify open and close happen across consecutive ticks.
2. Round with `startAt = NULL` — must never auto-open.
3. Round with `endAt = NULL` — must never auto-close.
4. Tournament `cancelled` — round must not transition.
5. Clock skew: inject `nowIso = round.startAt + 1ms` — verify open happens.
6. Pagination: 250 due rounds in one tick — verify all 3 pages process and the loop terminates.

**Priority:** P0 &nbsp;&nbsp; **Complexity:** M &nbsp;&nbsp; **Risk:** Medium if skipped (cron is critical infra).

---

## Phase 7 — Documentation Update

**File:** `docs/modules/tournament.md`.

Already updated in the previous iteration:

- `### TournamentRound` subsection under `## Lifecycle` with the state machine diagram and transition-rules table.
- Callout under `## Permissions` clarifying that round transitions are not permission-gated.
- New bullets under `## Invariants` (system-driven transitions; tournament-ongoing required for auto-open).
- Cross-reference under `## Future Extension Points`.

No further doc work needed. **Verify only.**

**Priority:** P1 &nbsp;&nbsp; **Complexity:** XS &nbsp;&nbsp; **Risk:** None.

---

## What Was Removed vs. Earlier Plan

| Removed | Reason |
|---|---|
| `RoundLifecycleService` (new file) | Lifecycle responsibility already owned by `TournamentLifecycleService`. |
| `RoundSchedulerService` (new file) | Scheduler responsibility already owned by `TournamentSchedulerService`. |
| `tournament.round.opened` / `tournament.round.closed` outbox events | No consumer exists. Adding event types requires extending `TournamentOutboxEventType`, `deserializePayload`, `toSharedEvent`, the discriminated-union type, etc. All of that is speculative without a consumer. |
| `TournamentRoundOpenedEvent` / `TournamentRoundClosedEvent` classes | No events means no event classes. |
| Round-opened notification handler | No product requirement exists. |
| `notifyRoundOpened` on `TournamentNotificationPort` | Same reason. |
| Feature flag (`TOURNAMENT_ROUND_SCHEDULER_ENABLED`) | Inconsistent with existing cron jobs. |
| Staged rollout plan | Cron jobs are low-blast-radius. |
| Future-extensibility seam (`RoundAdministrativeService`) | Pure speculation. No precedent in codebase. |
| Transaction wrapper around `markRoundStatus` | Single guarded UPDATE is sufficient today. The `tx?` parameter on the repository method is reserved for future use without changing the lifecycle method signature. |
| Architectural-seam section in the plan | Same reason. |

---

## Rollout

### Pre-Rollout

1. Confirm no production rows have `status = 'running'` (one SQL query — see `docs/round-lifecycle-prechecks.sql.md` Q1).
2. Confirm `round.startAt` rows where `startAt` is in the past but the round is still `pending` — count for awareness of first-deploy burst (Q2 in prechecks).

### Observability

Reuse the existing structured-log pattern:

- `tournament_scheduler_round_open_start`
- `tournament_scheduler_round_open_complete` (`roundsOpened`)
- `tournament_scheduler_round_open_failed` (`error`)
- `tournament_scheduler_round_close_start`
- `tournament_scheduler_round_close_complete` (`roundsClosed`)
- `tournament_scheduler_round_close_failed`
- `tournament_scheduler_skipped_lock_held` (reuse)

### Rollout Sequence

1. Staging: deploy. Observe 24h.
2. Production: deploy on one replica. Verify lock semantics hold across replicas for one cron window.
3. Production: deploy on remaining replicas.

No feature flag. The scheduler is opt-in by deployment, not by runtime config — consistent with the existing pattern.

---

## Migration Concerns

### Existing seed data

Round statuses in the seed file:

- `ongoing` tournament → rounds seeded as `open`. ✓ No change needed.
- `registration` tournament → rounds seeded as `pending`. ✓ Matches new behavior.
- `finished` tournament → rounds seeded as `finished`. ✓ Unchanged.

**No seed migration required.**

### Schema

No DB schema change. The Postgres enum already contains only `pending | open | running | finished`. If Phase 1 confirms `'running'` is unused, we do not change the DB enum in this iteration — only the TypeScript enum.

### Outbox

No new event types. The existing outbox is not touched.

---

## Phase Summary

| Phase | Title | Priority | Complexity | Risk | Breaking | Depends on |
|---|---|---|---|---|---|---|
| 1 | Enum cleanup | P0 | XS | Low | No | — |
| 2 | Repository additions | P0 | S | Low | No | Phase 1 |
| 3 | Lifecycle service methods | P0 | S | Low | No | Phase 2 |
| 4 | Scheduler methods | P0 | S | Low | No | Phase 3 |
| 5 | Module wiring (verify) | P0 | XS | None | No | Phase 4 |
| 6 | Tests | P0 | M | Med | No | Phases 1–5 |
| 7 | Documentation (verify) | P1 | XS | None | No | All code |

---

## Suggested Implementation Order

**Phase 1 → 2 → 6 (repo tests) → 3 → 6 (lifecycle tests) → 4 → 6 (scheduler tests) → 5 (verify) → 7 (verify).**

Skip nothing. The scheduler is critical infrastructure and must be tested before exposure. Documentation comes last so it describes observed behavior.

---

## Open Questions

Resolved by prechecks in `docs/round-lifecycle-prechecks.sql.md`:

1. Is `'running'` ever written? — Run the composite dashboard query before Phase 1.
2. First-deploy burst size? — Quantified by precheck Q2.
3. Are `startAt` / `endAt` always populated? — Precheck Q3. Confirms whether the `IS NOT NULL` guards are defensive or load-bearing.
4. Notification fan-out sizing? — Not relevant in v1 (no notifications). Precheck Q4 reserved for future use.
5. Timezone storage? — Precheck Q5. Confirms ISO-8601 UTC.
6. Lock TTL sizing? — Precheck Q6. Validates 5-minute TTL via `EXPLAIN ANALYZE`.
7. Mid-round tournament finalize behavior? — Precheck Q7. Defaults to "rounds close on their own `endAt`" (matches the documented plan).