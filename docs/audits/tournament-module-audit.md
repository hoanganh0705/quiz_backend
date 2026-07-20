# TOURNAMENT MODULE — PRODUCTION READINESS AUDIT REPORT

**Module path:** `src/modules/tournament/`
**Scope:** Full module — controllers, application service, domain service, lifecycle service, repository, listeners, scheduler, DTOs, OpenAPI, database schema/migrations.

## Executive Summary

The Tournament module is functional but has **numerous production-blocking issues** spanning business-logic invariants, authorization, concurrency, transaction boundaries, event reliability, and documentation drift. The most acute risks are:

1. **Authorization bypass** — there is no admin endpoint to update/delete/cancel a tournament; an attacker who created a tournament cannot update or delete it through any HTTP surface (silent dead code), while the schema is missing tournament ownership.
2. **Race conditions** in registration, full-tournament boundary, and reactivation.
3. **Event emission outside the DB transaction** — `TournamentJoinedEvent` and `TournamentParticipantWithdrawnEvent` are emitted after the participant write returns, so a process crash between commit and enqueue silently loses the event.
4. **No idempotency** for register/withdraw/unregister/start-attempt — duplicate POSTs cause observable side-effects or 409s the second time.
5. **Soft-delete leak** — most read queries filter `deleted_at IS NULL`, but `markTournamentStatus` allows transitioning a _soft-deleted_ tournament's status via a `fromStatus='registration'` to `'ongoing'` because the read only checks `status='registration'` (without joining deleted), and the UPDATE silently ignores `deleted_at`.
6. **Scheduler is not lock-protected** — `handleRegistrationOpen`/`handleTournamentStart`/`handleTournamentFinalize` can double-run on multi-replica deployments, emitting duplicate notifications or double-finalizing.

Below is the complete issue list with severity, location, impact and direction. Issues are grouped and indexed for cross-reference.

---

## Issue #1 — No Admin Endpoint to Update / Soft-Delete / Cancel a Tournament (missing feature ⇒ exposed invariants)

**Severity:** Critical
**Category:** Authorization / Business Logic / API Design
**Location:**

- `src/modules/tournament/transport/controller/tournament.controller.ts` (entire controller)
- `src/modules/tournament/domain/tournament.service.ts` (no `updateTournament`, `cancelTournament`, `softDeleteTournament`)
- `src/core/database/schema/tournament/schema.ts` (no `created_by_user_id` / `owner_user_id` on `tournaments`)

**Affected files:**

- `tournament.controller.ts`
- `tournament.service.ts`
- `tournament.repository.ts`
- `tournament.dto.ts` (no `UpdateTournamentDto`)
- `swagger/examples/*`

**Description.** The controller only exposes `POST /` (create), `POST /:id/register`, `POST /:id/withdraw`, `DELETE /:id/register`. There is no:

- `PATCH /:id` (update title/description/prize/category/startAt/endAt/maxParticipants)
- `DELETE /:id` (soft delete via `deleted_at`)
- `POST /:id/cancel` (transition to `cancelled`)

The `tournament_status` enum explicitly includes `'cancelled'` (`0000_lean_ken_ellis.sql:19`), but no code path ever writes that value — and there is no UPDATE/DELETE repository method at all for the `tournaments` table other than `markTournamentStatus` (status-only) and the `registerParticipant` / `withdrawParticipant` cascade.

**Why this is incorrect.**

- **Authorization cannot be applied to updates/deletes** because no such operation exists; an admin role has no escalation path for misbehaving tournaments.
- **Unpublishing or correcting** a tournament before registration is impossible.
- **An obviously invalid tournament** (e.g. wrong title, zero `max_participants`) cannot be removed. A moderator cannot soft-delete it.
- The `TournamentService.createTournament` accepts no `owner` field — the tournament is created by the admin but not attributed.

**Example scenario.** Admin A creates "Tournament X" with `startAt` in the past. There is no API to cancel it; users continue to call `/register`, receive `TournamentRegistrationClosedError`, and the broken tournament stays in the listing endpoints forever. Conversely, there is no endpoint to fix a typo in the title before registration opens.

**Impact.**

- Broken content moderation.
- Permanent presence of misconfigured tournaments.
- The `cancelled` enum value is dead and misleading.
- Privilege escalation impossible because there is no endpoint to escalate to.

**Suggested direction.** Add `PATCH /tournaments/:id` and `DELETE /tournaments/:id` and `POST /tournaments/:id/cancel`, gated by `TOURNAMENT_MODERATE` or `TOURNAMENT_MANAGE` (a new permission, or reuse `RANKING_ADMIN`). Soft-delete writes `deleted_at = now()` and the repository queries already filter on it.

**OpenAPI impact.**

- Add three new endpoints to `tournament.controller.ts`.
- Add `UpdateTournamentDto` and `CancelTournamentResponseDto` request/response schemas.
- Add `401`, `403`, `404`, `409` error response schemas.
- Document that `cancel` requires the tournament to be in `upcoming` or `registration` status (not `ongoing`/`finished`).

---

## Issue #2 — No Tournament Ownership Column / Authorization Anchor

**Severity:** Critical
**Category:** Authorization / Data Integrity
**Location:**

- `src/core/database/schema/tournament/schema.ts` (no `owner_user_id` / `created_by_user_id` on `tournaments`)
- `0000_lean_ken_ellis.sql` (no such column in `tournaments` CREATE TABLE)
- `tournament.service.ts:createTournament` (no `ownerId` recorded)

**Affected files:**

- `core/database/schema/tournament/schema.ts`
- `core/database/migrations/0000_lean_ken_ellis.sql`
- `tournament.service.ts`

**Description.** `tournaments` has no column recording who created it. Any admin can call `POST /tournaments` (the `TOURNAMENT_CREATE` permission is granted to every `admin` role) and there is no way to attribute the action to a specific creator. Combined with the missing update/delete endpoints (#1), this means:

- No auditability of who created which tournament.
- No authorization anchor for "owner can edit their own tournament, admin can edit any".
- The `tournament.controller.ts` header comment on `createTournament` says "Requires the `TOURNAMENT_CREATE` permission" — but anyone with that permission (every admin) can create, and the only available admin user is any `admin` role.

**Why this is incorrect.** Authorization always requires an owner; without one, "the admin who created X" cannot be enforced.

**Impact.**

- Cannot attribute tournaments to creators.
- Cannot enforce per-creator ownership for future update/delete endpoints.
- Audit logs (the `event: 'tournament_created'` log in `tournament.service.ts:108-113`) record `userId: user.sub`, but no DB row does.

**Suggested direction.** Add `owner_user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT` via a new migration, populate it from `user.sub` on create, and write a `TOURNAMENT_EDIT_OWN` / `TOURNAMENT_EDIT_ANY` authorization policy.

**OpenAPI impact.**

- The new column must be reflected in `TournamentResponseDto` (`ownerUserId`).
- New admin endpoints in #1 must declare ownership checks.

---

## Issue #3 — Register Race: Duplicate Participant Possible When Two Requests Arrive Simultaneously

**Severity:** Critical
**Category:** Concurrency / Transaction / Data Integrity
**Location:** `src/modules/tournament/domain/tournament.service.ts:377-439` (`registerForTournament`)

**Affected files:**

- `tournament.service.ts`
- `tournament.repository.ts` (`registerParticipant` at 598-628, `getParticipantByUserAndTournament` at 569-596)

**Description.** `registerForTournament` performs:

1. `getTournamentById` (read)
2. `getParticipantByUserAndTournament` (read) — **no row lock**
3. `countParticipants` (read) — **no row lock**
4. `registerParticipant` (insert) — relies on `uq_tournament_participants_tournament_user` to dedupe

There is no transactional boundary. Two concurrent register requests for the same `(userId, tournamentId)` race:

- Both reads return `null` (participant doesn't exist).
- Both reads return `count < max`.
- Both reach `registerParticipant`.
- The DB enforces the unique constraint, so one succeeds and the other receives a `23505 unique_violation` which **is not caught** — it surfaces as a 500.

Furthermore, two concurrent requests for _different users_ when `count == max - 1` can both pass the cap check, and both insert → the tournament ends up over capacity.

**Why this is incorrect.**

- No `SERIALIZABLE` isolation, no `SELECT … FOR UPDATE`, no atomic insert.
- Unique-constraint error is uncaught (returns 500 instead of a clean 409 `TournamentAlreadyRegisteredError`).
- The full-tournament check (`countParticipants`) is a TOCTOU race.

**Example scenario.**

- Tournament has `maxParticipants = 10`, currently 9 active participants.
- User A and user B send `POST /register` within 50 ms of each other.
- Both threads observe `count = 9`, both insert.
- Final state: 11 participants, violating the cap. The DB has no CHECK that caps active participants, only `tournaments_max_participants_positive`.

**Impact.**

- Permanent cap violation. The `tournament_stats.participants` counter will be wrong forever.
- 500s on duplicate register under load.
- No way for users to distinguish "already registered" from "server bug".

**Suggested direction.**

- Wrap the full flow in `db.transaction(...)`.
- Use `INSERT … ON CONFLICT (tournament_id, user_id) DO NOTHING RETURNING …` and detect "no row returned" → 409.
- For capacity: lock the tournament row with `SELECT … FOR UPDATE` inside the transaction (or use `SELECT count(*) FROM tournament_participants WHERE tournament_id=$1 AND status='active' FOR UPDATE` — but row-level lock isn't enough; use an advisory lock keyed on `tournament_id` or rely on a serializable transaction with retry).

**OpenAPI impact.**

- Document `409` for "Tournament is full" (currently documented as `400` — see #18).
- Add `500` rate-limiting note.

---

## Issue #4 — Reactivation Race + Inconsistent Status Reporting

**Severity:** High
**Category:** Concurrency / Business Logic
**Location:** `tournament.service.ts:393-411`

**Affected files:**

- `tournament.service.ts`
- `tournament.repository.ts` (`reactivateParticipant` at 658-684)

**Description.** When a user was previously `withdrawn` and re-registers:

- Service code reads the participant (no lock).
- Calls `reactivateParticipant` which unconditionally sets `status='active'`, `withdrawn_at=null`, `updated_at=now()`.
- Returns the reactivated row.
- **No capacity check is performed before reactivation.** If the tournament is now full because other users filled the spot the withdrawn user freed, the reactivation succeeds anyway.

Additionally, the `countParticipants` race in #3 affects reactivation too: a concurrent re-register and reactivation by the _same_ user is safe (idempotent at the DB level), but a _re-registration that arrives just as a `withdrawParticipant` is in flight_ can leave the user in `withdrawn` status even though they tried to re-register.

**Why this is incorrect.** Reactivation is treated as "free" but it should respect the same `maxParticipants` cap.

**Example scenario.** Tournament has 100/100 participants. User A withdraws. Two new users race the register endpoint — one wins (101st). User A, having changed their mind, sends `POST /register`. Reactivation succeeds; 102 active participants.

**Impact.** Permanent capacity violation, identical to #3 but via the reactivation path.

**Suggested direction.** Re-validate `countParticipants < maxParticipants` before calling `reactivateParticipant`, ideally inside the same locked transaction as #3.

**OpenAPI impact.** Document `TournamentFullError` for the reactivation path; add business-rule note in the `registerForTournament` description.

---

## Issue #5 — Events Published AFTER the DB Transaction, Outside Any Transaction ⇒ Lost Events

**Severity:** Critical
**Category:** Event / Transaction
**Location:**

- `tournament.service.ts:434-436` (`TournamentJoinedEvent`)
- `tournament.service.ts:518-524` (`TournamentParticipantWithdrawnEvent`)
- `tournament-lifecycle.service.ts:60-69, 137-159` (`TournamentStartingSoonEvent`, `TournamentCompletedEvent`, `TournamentWonEvent`)

**Affected files:**

- `tournament.service.ts`
- `tournament-lifecycle.service.ts`
- `bullmq-tournament-event-bus.service.ts` (the publish path)

**Description.** Events are published _after_ the database write returns successfully, with no transactional outbox:

- `registerForTournament` commits the participant row, then calls `eventBus.publish(new TournamentJoinedEvent(...))`.
- `withdrawFromTournament` commits the withdrawal, then publishes.
- `finalizeDueTournaments` writes `rank_final` + `status='completed'` inside `finalizeTournament`'s transaction, then publishes `TournamentCompletedEvent` _after_ the transaction returns.

If the process crashes (or the connection drops, or the BullMQ enqueue fails) between the DB commit and the publish, the event is lost forever. There is **no** outbox table, **no** at-least-once delivery, **no** recovery job.

Furthermore, the existing `outbox_events` table (`0000_lean_ken_ellis.sql:261-275`) is used by other modules (e.g. `review-outbox-processor.service.ts`), but the Tournament module does not write to it.

**Why this is incorrect.** The XP dispatch path (`tournament-event.processor.ts:98-128`) is triggered by `tournament.won` events. If a winner event is lost:

- The user never receives the `external.xp.earned` event.
- Their `user_ranking.all_time_xp` is never updated for that tournament.
- The leaderboard and ranking pages drift from the canonical truth.
- Notification fans out from `TournamentListenerAdapter.handleTournamentWon` → `notifyTournamentWon` is also skipped → the user does not learn they won.

The same applies to `TournamentCompletedEvent` (used by `tournament-listener.adapter.ts:122` to fan out a "you completed" notification) and `TournamentStartingSoonEvent` (used to remind the user to play).

**Example scenario.** Process receives `finalizeDueTournaments` cron tick. It calls `finalizeTournament`, the DB commits ranks and statuses. Then the Node process is OOM-killed by Kubernetes _before_ it can publish the BullMQ jobs. Restart: `TournamentEventProcessor` has nothing in the queue; winners never receive XP; users see a "finished" tournament with no notification.

**Impact.**

- Lost XP grants.
- Lost notifications.
- Lost `social_feed_activities` (`tournament_joined`, `tournament_won`, `tournament_completed`).
- Lost achievement/badge triggers (downstream consumers of `SHARED_TOURNAMENT_EVENT_BUS`).

**Suggested direction.** Persist events into an outbox in the same transaction as the business write. A separate worker (or reuse `outbox_events` + the existing outbox processor pattern from `review-outbox-processor.service.ts`) drains it.

**OpenAPI impact.** No immediate spec change, but document the at-least-once delivery guarantee in the event-bus architecture doc.

---

## Issue #6 — `startRoundAttemptTx` Allows Re-Creating Attempt via the `existingRoundParticipant` Path Without Idempotency

**Severity:** High
**Category:** Concurrency / Idempotency
**Location:** `tournament.service.ts:573-610`, `tournament.repository.ts:832-948`

**Affected files:**

- `tournament.service.ts`
- `tournament.repository.ts`

**Description.** `startRoundAttempt` reads the round participant outside any transaction:

- `getRoundParticipant(roundId, participant.participantId)`
- If `existingRoundParticipant?.attemptId` is set → throws `TournamentAttemptAlreadyExistsError`.
- If `existingRoundParticipant` is null → calls `startRoundAttemptTx` (which inserts round_participant + attempt + updates round_participant.attempt_id atomically).
- If `existingRoundParticipant` exists with `attemptId=null` → calls `createAttemptForRound` (which inserts attempt + updates round_participant.attempt_id atomically).

The race: between `getRoundParticipant` and `createAttemptForRound`, a concurrent duplicate request for the same `(roundId, participantId)` will both pass the check, both reach `createAttemptForRound`, and **two attempts will be created** (the `uq_round_participant` unique constraint prevents the second `tournament_round_participants` row, but **does NOT** prevent two attempts on the same round participant — `attemptId` is non-unique, just a FK).

The check `existingRoundParticipant?.attemptId` is a TOCTOU.

**Example scenario.** A user double-clicks "Start round". Two HTTP requests arrive at the controller. Both pass `getRoundParticipant` (returns `attemptId=null`). Both call `createAttemptForRound`, each inserting a new `quiz_attempts` row. The user now has two attempts in flight, each potentially answering questions and producing two score updates to `tournament_round_participants.round_score` — whichever update lands last wins, but the count is wrong and both attempts may complete, double-granting XP via `attempt` flow.

**Why this is incorrect.**

- No atomic upsert on `tournament_round_participants` from the service side.
- The unique constraint is on `(participantId, roundId)`, not on `(participantId, roundId, attemptId)`. So the second attempt row slips through.
- The `existingRoundParticipant` check is non-transactional.

**Impact.**

- Duplicate attempts in `quiz_attempts` for the same tournament round.
- Doubled XP grants via the attempt completion event listener (`tournament-attempt-event-listener.adapter.ts:75-141` listens to `attempt.completed`, looks up the round participant by `attemptId` and writes `roundScore`/`roundTimeMs`).
- Counter drift on `tournament_round_participants` and ultimately `tournament_participants.total_score`.

**Suggested direction.**

- Use an atomic upsert: `INSERT … ON CONFLICT (round_id, participant_id) DO UPDATE SET attempt_id = … RETURNING attempt_id, (xmax = 0 AS inserted)`.
- Return the existing `attemptId` if already linked; only insert a new `quiz_attempts` row when inserted.
- Enforce idempotency: the `attemptId` column on `tournament_round_participants` is nullable but should be unique per (round_id, participant_id) when set, or use a separate `tournament_round_attempts` table with a UNIQUE on `(round_participant_id)` enforcing "one attempt per round participation".

**OpenAPI impact.** No spec change required if the API response stays the same, but document "idempotent on duplicate request — returns the existing attemptId" in `startRoundAttempt` description.

---

## Issue #7 — No Tournament Update / Edit / Delete Endpoint ⇒ Cannot Soft-Delete Misconfigured Tournaments

**Severity:** High
**Category:** API Design / Business Logic
**Location:**

- `tournament.controller.ts` (entire file)
- `tournament.service.ts` (no `updateTournament`, `softDeleteTournament`)
- `tournament.repository.ts` (no generic `updateTournament` method)

**Description.** The schema has `tournaments.deleted_at` (`0000_lean_ken_ellis.sql:640`) and the read queries filter `isNull(tournaments.deletedAt)` — but no code path ever writes `deleted_at`. There is no admin endpoint to soft-delete. The `tournament.controller.ts` has no `PATCH`, `PUT`, or `DELETE` methods (the only `@Delete` is `DELETE /:id/register`, which is unregister, not delete).

**Why this is incorrect.**

- Cannot remove spam/abusive/misconfigured tournaments.
- The `deleted_at` column is write-only dead.
- Cannot transition to `cancelled`.

**Impact.**

- Permanent listing of broken tournaments.
- Cannot implement content moderation on tournaments.

**Suggested direction.** See #1 (admin endpoints). Add `softDeleteTournament(tournamentId)` repository method that does `UPDATE tournaments SET deleted_at = now() WHERE tournament_id = $1 AND deleted_at IS NULL`. All existing read queries already filter `deleted_at IS NULL`, so soft-delete cascades naturally.

**OpenAPI impact.** New endpoint, new `204 No Content` or `200 OK` response.

---

## Issue #8 — `markTournamentStatus` Ignores `deleted_at` on Read but Filters on Update WHERE — Inconsistent

**Severity:** High
**Category:** Data Integrity / Concurrency
**Location:** `tournament.repository.ts:1166-1201` (`markTournamentStatus`)

**Affected files:**

- `tournament.repository.ts`
- `tournament-lifecycle.service.ts`

**Description.** `markTournamentStatus`:

```ts
.where(and(
  eq(tournaments.tournamentId, params.tournamentId),
  eq(tournaments.status, params.fromStatus),
  isNull(tournaments.deletedAt),
))
```

This is actually correct on the UPDATE side (filtered). But the _reads_ in the lifecycle paths (`listTournamentsStartingSoon` at 1133-1164, `listCompletedTournaments` at 281-322) also filter `isNull(tournaments.deletedAt)`, so a soft-deleted tournament is correctly excluded.

**However**, the lifecycle scheduler does not perform any explicit soft-delete check before transitioning. And the scheduler runs concurrently on every replica.

**Race.** `handleRegistrationOpen` (`tournament-scheduler.service.ts:24-45`) and `handleTournamentStart` (`52-69`) are _not protected by any distributed lock_. Both crons run every 5 minutes on every replica.

**Example scenario.**

- Replica A runs `handleTournamentStart`, calls `startDueTournaments`, which iterates `listTournamentsStartingSoon` and calls `markTournamentStatus(tournamentId, 'registration' -> 'ongoing')`.
- Replica B runs the same cron at the same time. `markTournamentStatus` uses optimistic-update (`WHERE status='registration'`) so only one will succeed per row, but BOTH replicas will iterate the list and BOTH will try to publish events (in `finalizeDueTournaments`).

For `dispatchStartingSoonNotifications` (`tournament-lifecycle.service.ts:29-79`), the duplicate is _amplified_: each replica iterates the same tournaments, advances them to `registration`, and publishes `TournamentStartingSoonEvent` for every participant. If the scheduler runs twice, **two notifications per participant are sent**.

For `finalizeDueTournaments`, the same issue: double-finalize attempts, but `markTournamentStatus(from='ongoing', to='finished')` uses `WHERE status='ongoing'`, so the second replica's update will return `null` (correct), and it `continue`s. But **the events for completed/won were already published by replica A**. So the duplicate-publish happens only if the scheduler is split across replica "responsibilities" or if the same replica double-schedules.

Actually, the bigger issue: `@nestjs/schedule` runs the same cron on every replica in a clustered deployment. The team needs a `SchedulerLock` (Redis-based advisory lock) or a `@nestjs/schedule` lock decorator, OR convert these to BullMQ delayed jobs.

**Impact.**

- Duplicate "starting soon" notifications.
- Duplicate "tournament won" notifications (the BullMQ processor handles idempotency only for XP via `externalEventBus.publishXpEarned`, which is _not_ idempotent — see #9).
- Duplicate XP grants if the worker is re-delivered.

**Suggested direction.**

- Wrap each cron in a Redis advisory lock (`SET tournament:scheduler:handle-registration-open NX PX 300000`).
- Or move all scheduled jobs into BullMQ delayed jobs with `jobId = tournamentId + ':' + phase` so duplicates are rejected by BullMQ's jobId uniqueness.

**OpenAPI impact.** No direct spec change.

---

## Issue #9 — XP Grant is Not Idempotent: Duplicate `tournament.won` Events Cause Duplicate XP

**Severity:** Critical
**Category:** Business Logic / Event
**Location:** `tournament-event.processor.ts:98-128`

**Affected files:**

- `tournament-event.processor.ts`
- `tournament-lifecycle.service.ts:148-159`
- The downstream `external.xp.earned` consumer (out of scope, but is the actual XP ledger writer)

**Description.** `handleEvent(event)`:

```ts
if (event.eventType === 'tournament.won') {
  const xp = computeTournamentXp(event.rank);
  if (xp > 0) {
    const xpEvent: ExternalXpEarnedEvent = {
      eventType: 'external.xp.earned',
      userId: event.userId,
      amount: xp,
      source: 'tournament',
      tournamentId: event.tournamentId,
      ...
    };
    this.externalEventBus.publishXpEarned(xpEvent);
  }
}
```

There is no idempotency key on the `ExternalXpEarnedEvent`. The BullMQ job that delivers it has `attempts: 3, backoff: exponential` — but if the worker crashes between BullMQ's "completed" callback and the actual XP ledger write, the job will be retried, and the user receives XP twice.

Also: the correlation ID is _re-generated_ (`createCorrelationId()`) in the processor — the original correlation from the publish site is replaced, breaking traceability.

**Why this is incorrect.**

- `external.xp.earned` should carry a deterministic `idempotencyKey` like `${tournamentId}:${userId}:${rank}` so the consumer can dedupe.
- The correlation ID regeneration severs the trace chain.

**Example scenario.**

- Tournament finishes. Replica A publishes `TournamentWonEvent` for user X (rank 1).
- BullMQ delivers to `TournamentEventProcessor`. Processor calls `publishXpEarned`.
- Processor crashes before BullMQ marks the job complete.
- BullMQ retries. The job runs again, publishing another `external.xp.earned` for the same `(tournament, user, rank)`.
- User X gets 1000 XP instead of 500.

**Impact.** Unbounded XP duplication across all winners; impossible to remediate without a full XP ledger audit.

**Suggested direction.**

- Add `idempotencyKey: ${tournamentId}:${userId}:${rank}` to `ExternalXpEarnedEvent` (and assert the consumer uses it).
- Propagate the original `correlationId` from the BullMQ job instead of generating a new one.
- Persist a `tournament_xp_grants(tournament_id, user_id, rank, xp_amount, granted_at)` table that the XP ledger consults before granting.

**OpenAPI impact.** No direct spec change, but document the at-most-once guarantee in the XP grant architecture doc.

---

## Issue #10 — `softDelete` Is Implemented in Schema But Has Zero Write Path

**Severity:** High
**Category:** Data Integrity / API Design
**Location:**

- `core/database/schema/tournament/schema.ts` (`deleted_at` column at line 60)
- All read methods filter `isNull(tournaments.deletedAt)`
- `tournament.repository.ts` has no `softDelete` or `update` method on `tournaments`

**Description.** The column exists in DDL, indexes reference it (`idx_tournaments_category_active WHERE deleted_at IS NULL` etc.), but no repository code writes it.

**Why this is incorrect.** Dead schema.

**Impact.** Moderation cannot soft-delete.

**Suggested direction.** Add `softDeleteTournament` (see #1, #7).

**OpenAPI impact.** New endpoint, see #1.

---

## Issue #11 — `getTournamentById` and `getTournamentDetailById` Do Not Filter `deleted_at` Consistently vs. the Listing Endpoints

**Severity:** Medium
**Category:** Data Integrity / API Consistency
**Location:** `tournament.repository.ts:57-127`

**Description.** Both `getTournamentById` and `getTournamentDetailById` filter `isNull(tournaments.deletedAt)` — good. But the detail query also uses a `LEFT JOIN tournamentParticipants` _without filtering the participants table by deleted_at_, so the participant count window function (`count(...) over (partition by tournament_id)`) counts ALL participants including `withdrawn` and `completed`. The same is true of `totalParticipants` exposed in the response (`tournament-detail-response.dto.ts:105`).

Wait — actually the `getTournamentDetailById` then re-queries `count()` filtering `status='active'` at lines 113-121. So the _response_ value is filtered correctly. But the SQL window function in lines 97-100 is wasted CPU and confusing — the `totalParticipants` it computes is overwritten by the second query.

**Why this is incorrect.** Two queries, the first is computed but discarded. Inefficient, and signals fragile code.

**Impact.** Mild performance hit; if someone removes the second query thinking it's redundant, `withdrawn` participants will be counted.

**Suggested direction.** Remove the window function in lines 97-100; rely solely on the second `count()` query (or merge them).

**OpenAPI impact.** No change.

---

## Issue #12 — `getActiveTournaments` Includes `registration`, `ongoing`, and Time-Window Tournaments but the Description Says Only "registration, ongoing, starting-soon"

**Severity:** Medium
**Category:** API Design / Documentation
**Location:** `tournament.controller.ts:225`, `tournament.repository.ts:237-279`

**Description.** The query at `tournament.repository.ts:243-247` filters:

```ts
isNull(tournaments.deletedAt),
sql`${tournaments.startAt} <= ${params.nowIso}`,
sql`${tournaments.endAt} >= ${params.nowIso}`,
```

This includes ANY tournament whose `[startAt, endAt]` window contains "now", regardless of `status` (e.g. `upcoming`, `registration`, `ongoing`, `finished`). That contradicts the controller description:

> "Returns an offset-paginated list of tournaments currently in the registration, ongoing, or starting-soon phases."

Also: the description mentions "starting-soon" as a phase, but `TOURNAMENT_STATUSES = ['upcoming', 'registration', 'ongoing', 'finished']` — there is no "starting-soon" status. The starting-soon window is a sub-phase of `upcoming`.

**Why this is incorrect.**

- The semantics of "active" is wrong: a `finished` tournament whose `endAt` is in the future (i.e. misconfigured) would appear in this list.
- The OpenAPI description does not match the implementation.

**Impact.**

- Surprising listings (e.g. `finished` tournaments may appear if `endAt > now`).
- API consumers cannot rely on the documented phase set.

**Suggested direction.** Filter explicitly on `status IN ('registration', 'ongoing')` and `startAt <= now < endAt`, OR change the description to "tournaments currently in their `[startAt, endAt]` time window, regardless of lifecycle status".

**OpenAPI impact.** Update the description on `getActiveTournaments`. Clarify the contract.

---

## Issue #13 — `getUpcomingTournaments` Filters Only on `startAt > now`, Ignoring `status`

**Severity:** Medium
**Category:** API Design / Documentation
**Location:** `tournament.repository.ts:183-235`

**Description.** The query filters only `startAt > nowIso`. So a `finished` tournament whose `endAt > now` AND whose `startAt > now` (e.g. re-scheduled) would appear. More importantly, a `cancelled` tournament (the only enum value that's not in the listing) would appear here.

**Why this is incorrect.** Should also filter `status = 'upcoming'` (or `status IN ('upcoming', 'registration')` to include ones whose registration has opened but the round hasn't started).

**Impact.** Surprising listings.

**Suggested direction.** Add `eq(tournaments.status, 'upcoming')` to the WHERE clause, or document the discrepancy.

**OpenAPI impact.** Update description.

---

## Issue #14 — `getCompletedTournaments` Filters Only on `endAt < now`, Ignoring `status`

**Severity:** Medium
**Category:** API Design / Documentation
**Location:** `tournament.repository.ts:281-322`

**Description.** The query filters only `endAt < nowIso`. A `cancelled` tournament whose `endAt < now` would appear. A `finished` tournament whose `endAt` is _after_ now (i.e. configuration bug) would not appear.

**Why this is incorrect.** Same as #13.

**Suggested direction.** Filter `status = 'finished'`.

**OpenAPI impact.** Update description.

---

## Issue #15 — `relatedTournaments` Has No Status Filter and Includes Cancelled/Deleted-Adjacent Tournaments

**Severity:** Medium
**Category:** Business Logic / API Design
**Location:** `tournament.repository.ts:324-396`

**Description.** `listRelatedTournaments` filters only `isNull(tournaments.deletedAt)`. There is no `status` filter. So a `finished` or `cancelled` tournament could be ranked as "related" to an active one.

**Why this is incorrect.** The endpoint description says "Tournaments related to the given tournament (same category or adjacent time window)". Including non-active tournaments is surprising.

**Impact.** Listing quality.

**Suggested direction.** Filter `status IN ('upcoming', 'registration', 'ongoing', 'finished')` — typically `finished` should be allowed (for historical browsing), but `cancelled` and `deleted` should not. Decide and document.

**OpenAPI impact.** Update description.

---

## Issue #16 — `listTournaments` (cursor) Includes ALL Statuses Including `cancelled`

**Severity:** Medium
**Category:** API Design
**Location:** `tournament.repository.ts:129-181`, `tournament.controller.ts:172-191`

**Description.** The cursor list endpoint does not filter `status`. So:

- A caller passing `?status=cancelled` gets it (this is the only way to discover cancelled).
- A caller with no filter gets every tournament — finished, cancelled, ongoing, registration — mixed together.
- A malicious or buggy client could request `?status=cancelled` to enumerate cancellations.

**Why this is incorrect.**

- The default listing should probably hide `cancelled`.
- No documentation on whether `cancelled` is exposed.

**Impact.** Predictability of the listing.

**Suggested direction.** Document the behavior. Add a sensible default (`status NOT IN ('cancelled')`) for unauthenticated public listings; require auth for `cancelled`.

**OpenAPI impact.** Update description; add a "status filter behavior" note.

---

## Issue #17 — `withdrawFromTournament` Allows Withdrawing a Completed Participant? No — It Throws — But Documented Status Map is Wrong

**Severity:** Low
**Category:** Business Logic / Documentation
**Location:** `tournament.service.ts:485-535`

**Description.** Looking at `withdrawFromTournament`:

- If `tournament.status !== 'ongoing'` → `TournamentWithdrawClosedError` (400).
- If no participant → `TournamentForbiddenError` (403).
- If `status === 'withdrawn'` → `TournamentAlreadyWithdrawnError` (409).
- If `status === 'completed'` → `TournamentWithdrawClosedError` (400).
- Otherwise (active) → withdraw, publish event.

The controller comment at `tournament.controller.ts:588-592` says:

> `TournamentParticipantStateError (409)        — user already withdrawn`

But the code throws `TournamentAlreadyWithdrawnError` (409 with a different code `TOURNAMENT_ALREADY_WITHDRAWN`). The 409 is correct in status, but the comment is misleading.

**Why this is incorrect.** Documentation drift.

**Impact.** Low. Confuses code reviewers and OpenAPI consumers.

**Suggested direction.** Update the controller comment.

**OpenAPI impact.** Update `withdrawFromTournament` 409 description to mention `TOURNAMENT_ALREADY_WITHDRAWN`.

---

## Issue #18 — `registerForTournament` Documents `TournamentFullError` as 400 But Logically Should Be 409

**Severity:** Low
**Category:** API Design / Documentation
**Location:**

- `tournament.controller.ts:425-432` (decorator says 400 with description "Tournament is full")
- `tournament-domain.errors.ts:170-175` (`TournamentFullError` is thrown by the service)

**Description.** The Tournament is full is a _state conflict_, semantically `409 Conflict`. Returning `400` makes it look like a request validation error. Most REST APIs use `409` for capacity violations.

**Why this is incorrect.** API semantics.

**Impact.** API consumers cannot distinguish "you sent garbage" from "the resource is at capacity".

**Suggested direction.** Change `TournamentFullError` mapping from `400` to `409`. Update controller decorator.

**OpenAPI impact.** Yes — change `400` → `409` for the "full" case. Two error responses (400 for `TournamentRegistrationClosedError`, 409 for `TournamentFullError`) need separate decorators.

---

## Issue #19 — Cursor Pagination Is Not Atomic: `limit + 1` Slice Can Drop Items Under Race

**Severity:** Low
**Category:** Concurrency / API Design
**Location:** `tournament.service.ts:140-163` and `tournament.repository.ts:160-178`

**Description.** The pattern:

```ts
const rows = await ...limit(params.limit + 1);
const hasNextPage = rows.length > limit;
const items = hasNextPage ? rows.slice(0, limit) : rows;
const lastItem = items.at(-1);
const nextCursor = ...lastItem ? ...
```

This is the standard "fetch limit+1" pattern. It is correct _in isolation_. But under concurrent inserts (new tournaments created while the user paginates), the cursor `createdAt < cursor.createdAt` filter can cause duplicate rows to appear across pages, or rows to be skipped if the cursor moves ahead in the same instant.

Specifically: if a tournament with `createdAt = T` is created mid-pagination, it will appear on whichever page it falls into based on the cursor ordering. This is acceptable for cursor pagination, but the cursor's secondary key (`tournament_id`) is a UUIDv7 (time-sortable), so two tournaments created in the same millisecond will tie and the cursor's `createdAt == X AND tournamentId < Y` tiebreaker will deterministically resolve. OK in practice.

**Why this is incorrect (minor).** The cursor uses `createdAt` and `tournamentId`, but the `tournament_id` column is `uuidv7()` which is time-ordered, so this is fine. But there's no documentation that UUIDv7 ordering is relied upon.

**Impact.** None in practice, but fragile if someone changes the default to UUIDv4.

**Suggested direction.** Add a comment near the cursor filter.

**OpenAPI impact.** No change.

---

## Issue #20 — `startRoundAttempt` Does Not Verify Round Belongs to Tournament

**Severity:** High
**Category:** Authorization / Business Logic / Data Integrity
**Location:** `tournament.service.ts:542-617`

**Description.** `startRoundAttempt` accepts a `tournamentId` and a `roundId` from the URL. It:

1. Calls `getActiveTournamentOrThrow(tournamentId)` — verifies the tournament exists and isn't deleted.
2. Calls `getRoundById(roundId)` — looks up the round, **without verifying it belongs to `tournamentId`**.
3. Calls `getRoundDetailById(roundId)` — same.
4. Calls `getParticipantByUserAndTournament(user.sub, tournamentId)`.

A malicious user could:

- Register for tournament A.
- Discover the roundId of tournament B (publicly listed via `GET /:id`).
- Call `POST /tournaments/A/rounds/{B-roundId}/attempts`.

The code would proceed: round B is `open`, participant A exists for tournament A, no attempt for A in round B (because A isn't a round participant of B), so it inserts a `tournament_round_participants` row for round B whose `participantId` belongs to tournament A. The `uq_round_participant` UNIQUE on `(participantId, roundId)` allows this — because `participantId` is from tournament A, no conflict.

Now the user has a "round participation" record in tournament B but no actual tournament_participant in B. Worse, when the round B finishes, `finalizeTournament` for B would query `tournament_participants WHERE tournament_id = B AND withdrawn_at IS NULL` — the user is NOT a participant in B, so they don't appear in B's standings. But the round_participant row still links them and `attempt.completed` will update `tournament_round_participants.round_score` for round B, and `recalculateParticipantTotals` will SUM across all round_participants of participant A — which means **a player's score in tournament A will be polluted by scores they earned in tournament B**.

**Example scenario.**

- Attacker registers for tournament A (`maxParticipants=100, easy`).
- Attacker also calls `POST /tournaments/A/rounds/B-round-1/attempts` where B-round-1 is a hard round in tournament B.
- Attacker completes the attempt (score=100 on a hard round).
- The listener updates `tournament_round_participants.round_score=100` for round B's row (which has `participantId=A_participant`).
- `recalculateParticipantTotals` recomputes A's total to include this 100 from B.

**Why this is incorrect.**

- No `round.tournamentId === tournamentId` check.
- Cross-tournament data corruption.

**Impact.**

- Cross-tournament leaderboard poisoning.
- Wrong XP if a downstream consumer trusts `tournament_participants.total_score` for ranking.
- Loss of trust in standings.

**Suggested direction.** In `startRoundAttempt`, after fetching the round, verify `round.tournamentId === tournamentId`. If not, throw `TournamentForbiddenError` (403) or `TournamentValidationError` (400). Same for `getRoundParticipant` which is called with `roundId, participantId` and doesn't verify the participant is for this tournament — but actually it does because `participantId` is the participant row.

**OpenAPI impact.** Update `startRoundAttempt` 400/403 description to mention "round does not belong to tournament".

---

## Issue #21 — `withdrawFromTournament` Allows Withdrawing a Soft-Deleted Tournament's Participant

**Severity:** High
**Category:** Authorization / Data Integrity
**Location:** `tournament.service.ts:485-535`

**Description.** `withdrawFromTournament` uses `getActiveTournamentOrThrow` which filters `isNull(deletedAt)`. Good. But if the tournament becomes soft-deleted _between_ the read and the write, the UPDATE still proceeds (no transactional check).

Worse, the `TournamentLifecycleService.finalizeDueTournaments` uses `listCompletedTournaments` which filters `endAt < nowIso` — a soft-deleted tournament with `endAt < now` is included. If a misconfigured tournament was soft-deleted, it can still be auto-finalized, emitting `TournamentCompletedEvent` and granting XP.

**Why this is incorrect.** Soft-delete should exclude from all lifecycle transitions.

**Suggested direction.** Add `isNull(deletedAt)` to all UPDATE and lifecycle queries (already on most reads; verify on writes too). Specifically `markTournamentStatus` does include it (line 1182) — but the finalizer's `listCompletedTournaments` doesn't filter on status, only on `endAt < now` (line 287-291). So a `cancelled` tournament will be auto-finalized if its `endAt` is in the past.

**Impact.** Auto-finalization of cancelled tournaments; duplicate events.

**Suggested direction.** Filter `status = 'ongoing'` in `listCompletedTournaments` (rename to `listOngoingTournamentsToFinalize` for clarity).

**OpenAPI impact.** No change.

---

## Issue #22 — `withdrawFromTournament` Emits Event But Does Not Decrement `tournament_stats.participants`

**Severity:** Medium
**Category:** Counter Audit / Event
**Location:** `tournament.service.ts:485-535`, `tournament.repository.ts`

**Description.** `withdrawFromTournament` updates `tournament_participants.status='withdrawn'` and `withdrawn_at=now`. It does NOT update `tournament_stats.participants`. But the stats counter is refreshed by `refreshTournamentStats` only at `finalizeTournament` time. So:

- During a tournament, `GET /:id/stats` reads from `tournament_stats` if it exists, otherwise from a fallback query.
- The fallback query (`getTournamentStats`) counts ALL participants regardless of status (line 451-455, no `status` filter on the LEFT JOIN).
- But the cached `tournament_stats.participants` is only written once — at finalization — and includes the participants count at that moment.

If a participant withdraws after `refreshTournamentStats` has been called (but finalization hasn't), `tournament_stats.participants` is stale.

**Why this is incorrect.**

- Cached stats counter drift.
- `tournament_stats.participants` is the "registered" count at finalization time, not "active" or "remaining" — semantic confusion.

**Suggested direction.**

- Document what `tournament_stats.participants` means ("registered at finalization" vs "active during tournament").
- Update `refreshTournamentStats` to be called on withdrawal OR remove the counter entirely and always compute from `tournament_participants` on read.

**OpenAPI impact.** Update the description on `participants` and `completedParticipants` fields.

---

## Issue #23 — `tournament_stats` Refresh Uses Aggregate From `tournament_participants` Totals, Not Live Round Data

**Severity:** Medium
**Category:** Counter Audit / Concurrency
**Location:** `tournament.repository.ts:473-515` (`refreshTournamentStats`), compared to `finalizeTournament` at 1203-1352

**Description.** Two paths compute stats:

1. `refreshTournamentStats` (called by `finalizeTournament`): aggregates from `tournament_participants.total_score`, `total_time_ms`, `rank_final`. The `total_score` etc. are denormalized counters.
2. `finalizeTournament`'s `ranked` CTE: aggregates from `tournament_round_participants.round_score`/`round_time_ms` directly. This is correct even if the denormalized totals drift.

So the rank computation is drift-proof, but `tournament_stats` is NOT — it uses the denormalized counters.

The "Fix #1" comment at lines 1230-1234 acknowledges the drift for ranks, but the stats refresh uses the cached totals.

**Why this is incorrect.**

- `tournament_stats.averageScore`, `highestScore`, `lowestScore`, `averageRank` are computed from cached counters.
- Drift in `tournament_participants.total_score` directly poisons `tournament_stats`.

**Impact.** Stats endpoints can show wrong aggregates.

**Suggested direction.** Re-compute `tournament_stats` aggregates from `tournament_round_participants` SUMs, mirroring the `ranked` CTE in `finalizeTournament`.

**OpenAPI impact.** No change.

---

## Issue #24 — `getTournamentStats` Returns Different Shape Depending on Whether `tournament_stats` Row Exists

**Severity:** Low
**Category:** API Design / Counter Audit
**Location:** `tournament.repository.ts:398-471`

**Description.** The function has two paths:

1. If `tournament_stats` row exists → return it (with `tournament.startedAt`, `endedAt`).
2. Else → fallback aggregation with empty stats.

The shape is the same (TournamentStatsRow), but:

- `averageScore` from cache is `numeric(10,2)`, fallback returns `numeric(10,2)::int`-ish.
- `averageRank` from cache is numeric, fallback is numeric.
- Both are then converted to `number` in TypeScript (`Number(stats.averageScore ?? 0)`).

For tournaments that haven't been finalized, `tournament_stats` is empty → fallback returns `participants=COUNT(*)`, which counts `withdrawn` and `completed` participants alike. There is no filter on status.

**Why this is incorrect.**

- `participants` for an in-progress tournament includes withdrawn users, contradicting the typical interpretation ("how many active players").

**Impact.** Misleading stats.

**Suggested direction.** Document the semantics. If `participants` means "ever registered", state so. If "currently active", filter `status='active'`.

**OpenAPI impact.** Update description on `participants`.

---

## Issue #25 — `tournament-detail-response.dto.ts` `totalParticipants` Counts Active Only, But Controller Has No Semantics Clarification

**Severity:** Low
**Category:** API Design
**Location:**

- `tournament.repository.ts:113-121` (count query)
- `tournament-detail-response.dto.ts:104-105` (description: "Number of registered participants")

**Description.** The detail query computes `totalParticipants` filtering `status='active'`. The DTO description says "Number of registered participants". "Registered" is ambiguous: does it mean "ever registered" (including withdrawn) or "currently active"?

**Why this is incorrect.** Ambiguous semantic.

**Suggested direction.** Change the description to "Number of currently active participants" or include both counts.

**OpenAPI impact.** Update description.

---

## Issue #26 — `markTournamentStatus` Allows Status Transitions That Should Be Disallowed

**Severity:** High
**Category:** Business Logic
**Location:** `tournament.repository.ts:1166-1201`

**Description.** The method accepts any `(fromStatus, toStatus)` pair and performs the UPDATE. There is no state machine guard. Allowed transitions in the codebase:

- `'upcoming' → 'registration'` (in `dispatchStartingSoonNotifications`)
- `'registration' → 'ongoing'` (in `startDueTournaments`)
- `'ongoing' → 'finished'` (in `finalizeDueTournaments`)

But the _repository_ does not enforce these. A future caller (or a buggy new feature) could call:

- `markTournamentStatus(tournamentId, 'finished', 'registration')` — resurrecting a finished tournament.
- `markTournamentStatus(tournamentId, 'cancelled', 'ongoing')` — bypassing the cancellation.

**Why this is incorrect.** No state machine integrity at the data layer.

**Impact.** Future bugs, data corruption.

**Suggested direction.** Either:

- Encode allowed transitions in the service layer (each call site checks before calling).
- Or enforce in the DB via a CHECK constraint: `CHECK (status = 'finished' OR updated_at + interval …)`.
- Or use a Postgres trigger.

**OpenAPI impact.** No direct change.

---

## Issue #27 — `listRelatedTournaments` Is Computed In-Memory Per Request — O(N) + Score Calculation Per Request

**Severity:** Medium
**Category:** Performance
**Location:** `tournament.repository.ts:324-396`

**Description.** Every call to `GET /tournaments/:id/related`:

1. Selects up to `limit * 3` tournaments (line 361).
2. Fetches the source tournament.
3. Scores each candidate in JS based on title/description/category overlap.
4. Sorts, slices.

For `limit=20`, this is 60 candidates scored per call. The `description` word comparison is `O(D*W*D')` per row. With 1000 active tournaments in the DB and many concurrent calls, this is wasteful.

**Why this is incorrect.**

- No caching.
- The `score > 0` filter is applied _after_ sorting — wasteful if many are zero.
- Word splitting doesn't handle Unicode, multi-byte, or hyphenated words well.

**Impact.** Performance under load. Also, no pagination — if there are 60 candidates and 5 are scored > 0, you get 5; if there are 1000 candidates, the LIMIT 60 caps the search.

**Suggested direction.**

- Cache the related-tournaments result per `(tournamentId, limit)` for N minutes.
- Or store a `related_tournament_scores` table updated on tournament insert/update.

**OpenAPI impact.** No change.

---

## Issue #28 — `getLeaderboard` Is Unbounded — Returns ALL Active+Completed Participants in One Response

**Severity:** High
**Category:** Performance / API Design
**Location:** `tournament.repository.ts:950-985`

**Description.** `getLeaderboard` returns every active + completed participant in a single response. There is no pagination, no limit.

A tournament with 100,000 participants will return 100,000 rows. The wire format includes avatarUrl, username, displayName — this is large.

**Why this is incorrect.**

- API contract has no `limit` or `top` parameter.
- DTO description says "Leaderboard entries sorted by rank" — implies bounded.

**Impact.** Slow response, large payload, possible OOM on Node side.

**Suggested direction.** Add `limit` (default 100, max 1000) and `offset` query params. Update the DTO.

**OpenAPI impact.** Yes — add `limit`, `offset` query params, document the bound.

---

## Issue #29 — `getLeaderboard` Rank Field Is Assigned In-Memory (`index + 1`), Not Tied to DB `rank_final`

**Severity:** Medium
**Category:** API Design / Counter Audit
**Location:** `tournament.repository.ts:981-985`

**Description.** The leaderboard is `ORDER BY total_score DESC, total_time_ms ASC` (line 979). The rank is then assigned by the array index: `rank: index + 1`.

But:

- For participants with the same `total_score` and `total_time_ms`, two participants can share rank N (no dense ranking).
- The rank is computed from the cached `total_score`/`total_time_ms`, NOT from `rank_final`. So during a tournament (before finalization), the live rank differs from what `rank_final` will eventually be.
- The DTO exposes BOTH `rank` (live) and `rankFinal` (post-finalization) — confusing.

**Why this is incorrect.** API semantic ambiguity. Two "rank" fields.

**Suggested direction.** Either:

- Use `RANK() OVER (ORDER BY total_score DESC, total_time_ms ASC)` and choose between `ROW_NUMBER`, `RANK`, `DENSE_RANK`.
- Or document that `rank` is live and `rankFinal` is final.

**OpenAPI impact.** Clarify the description on `rank` and `rankFinal`.

---

## Issue #30 — `getMyTournamentStanding` Uses ROW_NUMBER (Not RANK/DENSE_RANK) — Tied Participants Get Different Ranks

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament.repository.ts:1075-1117`

**Description.** The SQL:

```sql
ROW_NUMBER() OVER (
  ORDER BY tp.total_score DESC, tp.total_time_ms ASC
) AS rank
```

`ROW_NUMBER` assigns unique sequential numbers, even for ties. So two participants with identical `(total_score, total_time_ms)` get ranks `1` and `2`. `RANK()` would give them both rank `1`. `DENSE_RANK()` would give them both `1` and the next person `2`.

**Why this is incorrect.** Tied participants should share a rank — this is the convention for leaderboards. Using `ROW_NUMBER` violates that.

**Impact.** Unfair rankings, participant confusion.

**Suggested direction.** Use `RANK()` and update the test expectations.

**OpenAPI impact.** No change.

---

## Issue #31 — `startRoundAttempt` Does Not Validate Round's `tournamentId` Against the URL Path — Cross-Tournament Attack (Same as #20)

**Severity:** Critical
**Category:** Authorization / Business Logic
**Location:** `tournament.service.ts:549-617`

**Description.** Already covered as #20. Restating: the most critical authorization issue in the module. The fix is a single equality check.

**Suggested direction.** After `getRoundById`, add `if (round.tournamentId !== tournamentId) throw new TournamentForbiddenError(...)`.

**OpenAPI impact.** Update `startRoundAttempt` description.

---

## Issue #32 — `TournamentEventProcessor.handleEvent` Only Handles `tournament.won` — Other Events Are No-Ops

**Severity:** Low
**Category:** Maintainability / Performance
**Location:** `tournament-event.processor.ts:98-128`

**Description.** The processor's switch handles only `tournament.won`. For `tournament.joined`, `tournament.completed`, `tournament.starting_soon`, `tournament.participant.withdrawn`, it does nothing (the `switch` falls through with no default and returns `Promise.resolve()`).

The `if (event.eventType === 'tournament.won')` is redundant with a switch — should be a switch with explicit no-ops or, better, each event should be handled (or the events not even enqueued if no handler exists).

**Why this is incorrect.** Wasted BullMQ jobs, wasted Redis storage, no value added.

**Impact.**

- Every `tournament.joined` event is enqueued, then processed in O(1) only to be discarded.
- `removeOnComplete: { count: 1000 }` fills with no-op completions.

**Suggested direction.** Either:

- Don't enqueue events that have no handler.
- Or make the worker handle all events (e.g. call `externalEventBus.publishXpEarned` only for `won`, and `notify` for others via the existing `TournamentListenerAdapter`).

**OpenAPI impact.** No change.

---

## Issue #33 — `tournament-attempt-event-listener.adapter.ts` Runs Inside the Same DB Pool as the Attempt Module — Race on `recalculateParticipantTotals`

**Severity:** Low
**Category:** Concurrency
**Location:** `tournament-attempt-event-listener.adapter.ts:107-123`

**Description.** The adapter wraps the round_participant update and `recalculateParticipantTotals` in a transaction. But the transaction uses `tx` for both. The `recalculateParticipantTotals` runs `UPDATE tournament_participants ...` inside the same transaction. If two `attempt.completed` events fire for the _same_ participant concurrently (e.g. two rounds complete nearly simultaneously), both transactions will:

1. Lock their own `tournament_round_participants` rows.
2. Try to `UPDATE tournament_participants` (different rows of round_participants, but same participant row).
3. The second transaction's UPDATE on `tournament_participants` will block until the first commits (row-level lock), then proceed with the SUM (which now includes both updates).
4. Result: correct final state.

So actually this is correct _for the same participant_. But:

- If `recalculateParticipantTotals` is called concurrently from two paths (the adapter AND the daily cron `reconcileAllParticipantTotals` at line 1407), the cron's CTE-based UPDATE may interleave.

The bigger issue: `recalculateParticipantTotals` does `UPDATE … FROM (SELECT SUM(...) FROM tournament_round_participants WHERE participant_id = X) AS agg WHERE tp.participant_id = X`. The SELECT reads round_participants; if a parallel INSERT into round_participants (from another attempt) hasn't committed yet, the SUM is stale.

**Impact.** Mild: the daily cron reconciles this. But mid-tournament scores can briefly be off.

**Suggested direction.** Use `SELECT … FOR UPDATE` on `tournament_round_participants` rows for the participant before computing SUM. Or accept the brief drift and rely on the daily cron.

**OpenAPI impact.** No change.

---

## Issue #34 — `tournament_attempt_event_listener_adapter.ts` Does Not Verify the Attempt Belongs to a Tournament Attempt (Not Solo)

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament-attempt-event-listener.adapter.ts:75-141`

**Description.** The listener subscribes to ALL `attempt.completed` events on the attempt bus, then queries `tournament_round_participants WHERE attempt_id = X`. If the attempt is for a solo quiz (not tournament), the SELECT returns null and the listener no-ops. OK.

But the `roundScore` is set to `Math.round(Number(event.scorePercent))`. This conflates percent with score. For a 10-question quiz where the participant got 7 correct, `scorePercent=70`. That gets stored as `roundScore=70`. For a 20-question quiz, 14 correct → `scorePercent=70` → `roundScore=70` again. So a 10-question round and a 20-question round produce identical scores for the same percentage. This makes the leaderboard dominated by round difficulty (number of questions) rather than raw performance.

**Why this is incorrect.** Score semantically conflates percent with absolute.

**Impact.** Unfair leaderboard across rounds with different question counts.

**Suggested direction.** Use the absolute `correct_count` from the attempt (if available) or the attempt's `xp_earned` or `score`. Look at `AttemptCompletedEvent` fields. Currently the listener uses `scorePercent`. Check if a `correctCount` field is available.

**OpenAPI impact.** No change.

---

## Issue #35 — `getRoundDetailById` Has a Suspicious Type Cast

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament.repository.ts:711-740`

**Description.** The query selects a row, then `const [row] = result as any; return (row as unknown as TournamentRoundDetailRow | undefined) ?? null;`. This double-`any` cast hides potential shape mismatches.

**Why this is incorrect.** Maintenance hazard. If the JOIN changes (e.g. add a column), the cast silently returns the wrong shape.

**Suggested direction.** Remove `as any` and `as unknown as`. Type the query result explicitly.

**OpenAPI impact.** No change.

---

## Issue #36 — `in-memory-tournament-domain-event-bus.ts` Is Dead Code But Still in the Module

**Severity:** Low
**Category:** Maintainability
**Location:** `src/modules/tournament/infrastructure/events/in-memory-tournament-domain-event-bus.ts`

**Description.** The `InMemoryTournamentDomainEventBus` is exported and exists, but `tournament.module.ts:42` binds `TOURNAMENT_DOMAIN_EVENT_BUS` to `BullmqTournamentEventBusService` — never to the in-memory bus. The in-memory bus has no test file that imports it (only the BullMQ one does). It's a relic.

**Why this is incorrect.** Dead code increases cognitive load and confuses new contributors.

**Suggested direction.** Delete the file OR wire it as the fallback when Redis is down.

**OpenAPI impact.** No change.

---

## Issue #37 — `tournament-shared-events.ts` Adapter Does Not Handle `tournament.starting_soon` or `tournament.completed`

**Severity:** Low
**Category:** Event
**Location:** `shared-tournament-event-bus.adapter.ts:85-103`

**Description.** The adapter's `toSharedEvent` switch has cases for `tournament.joined`, `tournament.participant.withdrawn`, `tournament.won`. It does NOT handle `tournament.starting_soon` or `tournament.completed`. Downstream consumers (Achievement, Social) listening on `SHARED_TOURNAMENT_EVENT_BUS` will not receive these events.

**Why this is incorrect.** Either:

- The downstream consumers don't need these events (and the upstream emit is wasted work).
- They do need them (and the missing bridge is a real bug).

**Impact.** Depends on consumer expectations.

**Suggested direction.** Decide and document. If consumers need them, add the cases. If not, stop emitting them upstream.

**OpenAPI impact.** No change.

---

## Issue #38 — Cron Jobs Run on Every Replica — No Distributed Lock

**Severity:** High
**Category:** Scheduling / Event
**Location:** `tournament-scheduler.service.ts:24-127`

**Description.** All four `@Cron` jobs lack any distributed-lock mechanism. In a multi-replica deployment, every replica runs every cron at the same minute, and they all process the same tournaments.

For `dispatchStartingSoonNotifications`, the double-processing causes duplicate notification fan-out (each replica publishes its own `TournamentStartingSoonEvent` per participant). The `markTournamentStatus` optimistic update prevents the state transition from double-applying, but the events do not have similar protection.

For `finalizeDueTournaments`, the `markTournamentStatus` filter (`status='ongoing'`) prevents a second replica from transitioning a tournament that's already finished, but the read phase (`listCompletedTournaments` selects `endAt < now`, regardless of status) means both replicas iterate the list and both attempt to call `finalizeTournament`. The first replica's transition succeeds; the second replica's `markTournamentStatus` returns null, but the second replica has already loaded the tournament and could publish events from a stale read.

Actually no — re-reading: the second replica's `markTournamentStatus` returns null (because the status is already 'finished'), and the code does `if (!tournament) continue;`. So the second replica skips the finalize. Good.

BUT: for `dispatchStartingSoonNotifications`, the second replica's `markTournamentStatus` (upcoming→registration) succeeds if the first replica's update hadn't committed yet (race). Both replicas then publish `TournamentStartingSoonEvent` for every participant.

**Why this is incorrect.** Duplicate notifications.

**Impact.** User-visible double notifications.

**Suggested direction.**

- Use a Redis advisory lock (`SET tournament:cron:registration-open <replica-id> NX PX 300000`).
- Or use a single-leader scheduler (run the crons on one replica only).

**OpenAPI impact.** No change.

---

## Issue #39 — `dispatchStartingSoonNotifications` Loads ALL Participants in a Single Page of Size `participantCount`

**Severity:** Medium
**Category:** Performance / Event
**Location:** `tournament-lifecycle.service.ts:53-70`

**Description.** The lifecycle calls `listParticipants({ page: 1, limit: participantCount })`. For a tournament with 100,000 participants, this loads 100,000 rows into memory and publishes 100,000 events sequentially in a `for` loop.

**Why this is incorrect.**

- Memory pressure.
- Long-running synchronous block (no batching).
- One bad handler blocks subsequent notifications.

**Suggested direction.** Batch notifications (e.g. publish in chunks of 100). Or write the events to an outbox and let a worker drain.

**OpenAPI impact.** No change.

---

## Issue #40 — `finalizeDueTournaments` Calls `markTournamentStatus` THEN `finalizeTournament` — Both Inside Per-Tournament Loop, But NOT Inside One Transaction

**Severity:** Medium
**Category:** Transaction
**Location:** `tournament-lifecycle.service.ts:109-170`

**Description.** The flow per tournament:

1. `markTournamentStatus(ongoing → finished)` (single UPDATE, atomic).
2. `finalizeTournament(...)` (which does its own transaction).

If `finalizeTournament` fails (e.g. DB error), the tournament is now `finished` but ranks haven't been computed. XP won't be granted. The next cron tick won't pick it up (status is no longer 'ongoing').

**Why this is incorrect.** Partial-write state on error.

**Impact.** Stuck tournaments that are finished but unranked.

**Suggested direction.**

- Move the `markTournamentStatus` and `finalizeTournament` into the same transaction (mark first, then compute ranks, then write rank_final — all atomic).
- Or do the status transition _last_ (after finalization succeeds).

**OpenAPI impact.** No change.

---

## Issue #41 — `TournamentEventProcessor.handleEvent` Discards `tournament.starting_soon` and `tournament.completed` Events

**Severity:** Medium
**Category:** Event
**Location:** `tournament-event.processor.ts:98-128`

**Description.** (Related to #32, #37.) The processor only emits XP for `tournament.won`. The other events are enqueued and processed but do nothing. They are then logged with `tournament_queue_job_completed`. This is wasted work for `TournamentStartingSoonEvent` (which the listener adapter _already_ handles locally — see below) and `TournamentCompletedEvent` (same).

Actually: `TournamentListenerAdapter` (`tournament-listener.adapter.ts:52-55`) subscribes to the _internal_ bus (via `TOURNAMENT_DOMAIN_EVENT_BUS.subscribe`). The internal bus is the BullMQ bus, which:

1. Calls in-process handlers (`publish` at `bullmq-tournament-event-bus.service.ts:42-53`).
2. Enqueues to Redis.

So `TournamentListenerAdapter.handleTournamentStartingSoon` IS called when the event is published — the in-process handler delivers it directly. The BullMQ job is a no-op duplicate.

**Why this is incorrect.** Double handling path. In-process delivery is correct; the BullMQ re-delivery is redundant for events with in-process consumers. But for events intended for _other_ replicas (multi-instance), the BullMQ re-delivery IS needed.

**Impact.** In single-replica deployments: events delivered twice (in-process + BullMQ re-delivery). The listener adapter handles each event twice → duplicate notifications.

**Suggested direction.** Decide on the canonical delivery model:

- In-process only (single-replica, simplest).
- OR BullMQ only (in-process handlers disabled).

The current code does BOTH, causing duplicates.

**OpenAPI impact.** No change.

---

## Issue #42 — `finalizeDueTournaments` Filters on `endAt < now`, Including Cancelled/Already-Finalized Tournaments

**Severity:** Medium
**Category:** Business Logic / Concurrency
**Location:** `tournament.repository.ts:281-322`, `tournament-lifecycle.service.ts:109-170`

**Description.** `listCompletedTournaments` filters `endAt < now`. This will include:

- `ongoing` tournaments whose `endAt` just passed (correct).
- `cancelled` tournaments whose `endAt` is in the past (incorrect).
- `finished` tournaments already finalized (filtered out at the `markTournamentStatus` step but still iterated).

The finalizer calls `markTournamentStatus(from='ongoing', to='finished')`. For a `cancelled` tournament, this fails (because `status='cancelled'`, not 'ongoing'), returns null, and the lifecycle `continue`s. Good.

BUT: the list is fetched with `endAt < now`, not `status='ongoing' AND endAt < now`. So the list is bigger than necessary, and the lifecycle iterates over cancelled tournaments for nothing.

**Why this is incorrect.** Inefficient iteration; relies on the UPDATE's WHERE filter to skip irrelevant rows.

**Suggested direction.** Add `eq(status, 'ongoing')` to the WHERE clause. Rename to `listOngoingTournamentsToFinalize`.

**OpenAPI impact.** No change.

---

## Issue #43 — Tournament Update Endpoint Missing — Cannot Fix Misconfigured Tournaments

**Severity:** High
**Category:** API Design / Business Logic
**Location:** Same as #1, #7.

**Description.** Already covered.

**Suggested direction.** Same as #1.

---

## Issue #44 — `markTournamentStatus` Allows `cancelled → anything` Transition (No Filter)

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament.repository.ts:1166-1201`

**Description.** If a tournament is `cancelled`, no code path calls `markTournamentStatus(from='cancelled')`. But the method itself doesn't enforce this. If someone in the future calls it, a cancelled tournament can be revived.

**Why this is incorrect.** No state machine guard.

**Suggested direction.** Disallow `fromStatus='cancelled'`.

**OpenAPI impact.** No change.

---

## Issue #45 — `registerForTournament` Does Not Check If the Tournament Has Already Started (`startAt < now`)

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament.service.ts:383-387`

**Description.** `registerForTournament` only checks `tournament.status === 'registration'`. But the scheduler transitions `registration → ongoing` every 5 minutes. If the scheduler is down for >5 minutes and `startAt` has passed, the tournament status is still `registration` but `startAt < now`. Users can register.

**Why this is incorrect.** A tournament whose `startAt` is in the past but whose `status` is still `registration` (due to scheduler failure) accepts new registrations.

**Suggested direction.** Also reject if `startAt <= now`.

**OpenAPI impact.** Document the rule.

---

## Issue #46 — `tournament-detail-response.dto.ts` `totalParticipants` Description Drift (Duplicate of #25)

**Severity:** Low
**Category:** Documentation

**Description.** Already covered.

---

## Issue #47 — `getMyTournamentStanding` Returns NULL If User Has a 0 Score — Wait No, It Returns Rank

**Severity:** Low
**Category:** API Design
**Location:** `tournament.repository.ts:1062-1117`

**Description.** The `getParticipantStanding` function:

1. Calls `getParticipantByUserAndTournament`. If user is `withdrawn`, returns null → 403.
2. Calls the SQL `WITH ranked AS (...) HAVING tp.participant_id = ${participant.participantId}`.

If the user has not started any round (no `tournament_round_participants` rows for them), their `total_score = 0, total_time_ms = 0`. The HAVING filter includes them in `ranked`. The COUNT(\*) OVER () includes them in `participant_count`. The ROW_NUMBER assigns them a rank.

So a user who has never played gets a rank — but is it meaningful? Their `score = 0, totalTimeMs = 0, rank = (participantCount)`. They share rank with other non-players via the tiebreaker `participantId ASC`.

**Why this is incorrect.** A user who hasn't played should not appear on the leaderboard.

**Suggested direction.** Filter the standing query to include only participants who have at least one round participant (or who have a non-zero score).

**OpenAPI impact.** Document the rule.

---

## Issue #48 — `startRoundAttempt` Accepts a Round in `pending` or `finished` Status — Wait, No, It Checks `'open'`

**Severity:** Low
**Category:** Business Logic
**Location:** `tournament.service.ts:556-558`

**Description.** `if (round.status !== 'open') throw new TournamentRoundNotOpenError(...)`. Good. But the round status enum is `['pending', 'open', 'running', 'finished']`. What does `'running'` mean? No code path sets `tournament_rounds.status='running'`. The round lifecycle is unclear.

**Why this is incorrect.** Incomplete state machine; dead `'running'` value.

**Suggested direction.** Either implement round lifecycle (pending → open → running → finished) or remove `'running'` from the enum.

**OpenAPI impact.** Document.

---

## Issue #49 — `tournament_attempt_event_listener_adapter` Can Update `roundScore`/`roundTimeMs` to Whatever the Listener Says, With No Validation

**Severity:** Medium
**Category:** Validation / Data Integrity
**Location:** `tournament-attempt-event-listener.adapter.ts:105-115`

**Description.** The listener casts `event.scorePercent` to a number, rounds, and writes to `roundScore`. The CHECK constraint is `round_score >= 0`. But:

- If the upstream event has a malformed scorePercent (e.g. `NaN`), `Math.round(NaN)` = `NaN`. PG would reject (NOT NULL violation since the column is NOT NULL but NaN isn't valid... actually PostgreSQL would error on a non-numeric input, but Drizzle might pass `NaN` as JS number which PG converts to NaN → server-side error → 500).
- No upper bound on `roundScore`. If someone sets `scorePercent = 1e10`, `roundScore` becomes 1e10.

**Why this is incorrect.** Untrusted input propagated to DB.

**Suggested direction.** Clamp `roundScore` to `[0, 100]` (or whatever the max is). Validate `Number.isFinite(event.scorePercent)`.

**OpenAPI impact.** No change.

---

## Issue #50 — `startRoundAttemptTx` Does Not Handle the Duplicate-Insert Race (`uq_round_participant`)

**Severity:** High
**Category:** Concurrency / Transaction
**Location:** `tournament.repository.ts:840-911`

**Description.** Two concurrent `startRoundAttemptTx` calls for the same `(roundId, participantId)` will both try to INSERT into `tournament_round_participants`. The UNIQUE constraint `uq_round_participant` will reject the second. But:

- The transaction will throw `23505 unique_violation`.
- The whole transaction is rolled back, including the `quiz_attempts` INSERT.
- The user receives a 500 instead of "you already started this round".

Actually — re-reading the service code:

```ts
if (!existingRoundParticipant) {
  // startRoundAttemptTx
} else {
  // createAttemptForRound
}
```

The service checks `getRoundParticipant` first. If `null` → call `startRoundAttemptTx`. If two concurrent calls both see `null`, both call `startRoundAttemptTx`. The second hits the UNIQUE violation. Same race as #6.

**Why this is incorrect.** Same as #6.

**Suggested direction.** Use `INSERT … ON CONFLICT DO NOTHING RETURNING`, then if no row was inserted, return the existing one (read again).

**OpenAPI impact.** Document.

---

## Issue #51 — `tournament_attempt_event_listener_adapter.ts` Overwrites Existing `roundScore`/`roundTimeMs` on Every `attempt.completed`

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament-attempt-event-listener.adapter.ts:108-117`

**Description.** The listener:

```ts
await tx.update(tournamentRoundParticipants)
  .set({ roundScore, roundTimeMs: event.timeTakenMs, updatedAt: event.nowIso })
  .where(eq(...));
```

This overwrites. If the attempt was retried (impossible in current API but the table allows `attemptId` updates via `createAttemptForRound`), the score is overwritten.

Also: there's no "best score" semantic. If a participant submits two attempts (hypothetically), the second wins. The `attemptId` is unique only by reference, not enforced.

**Why this is incorrect.** Best-score vs latest-score not specified.

**Suggested direction.** Either:

- Enforce one attempt per (round_participant, attemptId is set non-null) and disallow re-attempts at the service layer (already done — see `TournamentAttemptAlreadyExistsError`).
- Or use MAX(round_score) if multiple attempts allowed.

**OpenAPI impact.** Document.

---

## Issue #52 — `markTournamentStatus` Has a Subtle Bug: Returns `null` If `fromStatus` Doesn't Match, But Also Returns `null` If Soft-Deleted

**Severity:** Low
**Category:** API Design / Error Handling
**Location:** `tournament.repository.ts:1166-1201`

**Description.** The method's WHERE filter includes both `status='fromStatus'` and `isNull(deletedAt)`. If either fails, the UPDATE affects 0 rows and the method returns `null`. The caller cannot distinguish:

- The tournament is in a different status (race).
- The tournament is soft-deleted.
- The tournament doesn't exist.

**Why this is incorrect.** Ambiguous return.

**Suggested direction.** Return the current row (with `RETURNING ...`) regardless of the update, or include the `status` in the response so callers can disambiguate.

**OpenAPI impact.** No change.

---

## Issue #53 — `getRelatedTournaments` Description Mismatch — Says "Same category or adjacent time window" but Implementation Uses Title/Description/Category Score

**Severity:** Low
**Category:** Documentation
**Location:** `tournament.controller.ts:268-272`

**Description.** Description:

> "Returns tournaments related to the given tournament (same category or adjacent time window)."

Implementation: `tournament.repository.ts:373-393` scores on category match (+3), description word overlap (+1 each), title word overlap (+0.5 each). No "adjacent time window" factor.

**Why this is incorrect.** Documentation drift.

**Suggested direction.** Update description OR implement time-window adjacency.

**OpenAPI impact.** Yes — update the description to match implementation.

---

## Issue #54 — `tournament-detail-response.dto.ts` `totalParticipants` Field Is `number` But Source Can Be NULL → Casts to 0

**Severity:** Low
**Category:** API Design
**Location:** `tournament.repository.ts:124-126`

**Description.** If `countRow?.total` is null, returns `0`. If undefined (no row), returns `0`. Fine. But the DTO says `totalParticipants!: number;` — no nullable. So the API contract is "always a non-negative integer". OK.

But the `count()` Drizzle function returns `number` in TypeScript, even though it may be `bigint` from PG. If the count exceeds `Number.MAX_SAFE_INTEGER` (2^53), it loses precision. Tournaments > 9 quadrillion participants are unlikely, but worth noting.

**Suggested direction.** Use `BigInt` if necessary.

**OpenAPI impact.** No change.

---

## Issue #55 — `tournament-detail-response.dto.ts` `rounds` Field Always Empty Because There's No Endpoint to List Rounds Publicly? Wait — It Is Returned

**Severity:** Low
**Category:** Documentation
**Location:** `tournament-detail-response.dto.ts:107-108`

**Description.** The DTO has `rounds: TournamentRoundResponseDto[]`. The controller's `getTournamentById` calls `getTournamentById` then `getTournamentRounds`. So the rounds ARE returned.

But there is no `participantLimit` enforcement at the round level — `tournament_rounds.participant_limit` is nullable but no code reads or enforces it.

**Why this is incorrect.** Dead schema column.

**Suggested direction.** Implement round participant limit or remove the column.

**OpenAPI impact.** No change.

---

## Issue #56 — `TournamentListenerAdapter.handleTournamentWon` Always Passes `prize` to Notification Port — But Notification May Not Handle Undefined

**Severity:** Low
**Category:** Validation
**Location:** `tournament-listener.adapter.ts:99-104`

**Description.** Passes `prize: event.prize` (string | undefined). The notification port presumably accepts `string | undefined` or `string`. If it only accepts `string`, undefined crashes.

**Suggested direction.** Verify the notification port's signature.

**OpenAPI impact.** No change.

---

## Issue #57 — `withdrawFromTournament` Does Not Decrement `tournament_stats.participants`

**Severity:** Medium
**Category:** Counter Audit
**Location:** `tournament.service.ts:485-535`, `tournament.repository.ts`

**Description.** When a participant withdraws, `tournament_stats.participants` (cached counter) is not updated. Only `refreshTournamentStats` (called at finalization) writes it. During a tournament, the cached counter is stale.

**Why this is incorrect.** Counter drift.

**Suggested direction.** Either update the counter on withdrawal (with a comment that finalization is the source of truth), or document that `tournament_stats` is finalization-only.

**OpenAPI impact.** Update description.

---

## Issue #58 — `getTournamentWinners` Uses `LIMIT` But the Drizzle Query Is `LIMIT params.limit` Without `OFFSET`

**Severity:** Low
**Category:** API Design
**Location:** `tournament.repository.ts:987-1020`, `get-tournament-winners-query.dto.ts`

**Description.** The DTO has only `limit`. No `offset` or `page`. So winners are always top-N. OK. But:

- The query orders by `rankFinal ASC`. `rankFinal` is nullable; the `WHERE rankFinal IS NOT NULL` filter is applied. So winners are participants with ranks. Good.
- But there's no tiebreaker — two participants with the same `rankFinal` (shouldn't happen due to ROW_NUMBER, but possible if data is corrupted) will be ordered arbitrarily.

**Why this is incorrect.** Incomplete ordering.

**Suggested direction.** Add `userId ASC` tiebreaker.

**OpenAPI impact.** No change.

---

## Issue #59 — `getTournamentWinners` Filters `isNull(users.deletedAt)` but Does Not Filter `isNull(userProfiles.deletedAt)` — Wait, userProfiles Doesn't Have deleted_at

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament.repository.ts:1006`

**Description.** Filters `users.deletedAt IS NULL`. But `user_profiles` doesn't have a `deleted_at` column, so no filter needed. OK.

But the `LEFT JOIN userProfiles` means a deleted user with a profile row still has `displayName` and `avatarUrl` returned (since `LEFT JOIN` keeps the profile even if the user is filtered... wait no, it's an `INNER JOIN users` because `isNull(users.deletedAt)` is in the WHERE. So the user must not be deleted. The profile is then LEFT JOINed — so a profile row is included if it exists.

OK, this is correct.

**Why noted.** Just to confirm there's no bug here.

**Impact.** None.

---

## Issue #60 — `TournamentAttemptEventListenerAdapter` Does Not Check if the Tournament Has Already Been Finalized

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament-attempt-event-listener.adapter.ts:75-141`

**Description.** If a participant completes an attempt _after_ the tournament has been finalized (e.g. they were in-flight when the cron ran), the listener still updates `roundScore`/`roundTimeMs`. This mutates the historical record.

**Why this is incorrect.** Attempts after finalization should not affect scores.

**Suggested direction.** Check the tournament status before writing; ignore if `finished`.

**OpenAPI impact.** No change.

---

## Issue #61 — `tournament.controller.ts` `startRoundAttempt` OpenAPI Documents Wrong Status Codes

**Severity:** Low
**Category:** Documentation
**Location:** `tournament.controller.ts:526-535`

**Description.** The `@ApiBadRequestResponse` for `startRoundAttempt` lists:

- Path parameter malformed.
- "Tournament domain rejected the attempt start. Domain reason: 'Tournament round is not open'."

But the round_not_open error is `400` — correct. But the OpenAPI only lists one reason; the others (`TournamentRoundNotFoundError` → 404, `TournamentAttemptAlreadyExistsError` → 409, `TournamentForbiddenError` → 403) are also covered by other decorators. OK.

But: the `404` reason description says "Tournament not found, or tournament round not found" — but the round-not-found is the same code path as not-found-tournament (both throw 404). OK.

The `403` reason — `TournamentForbiddenError` — fires if the participant is not active. OK.

Documentation is mostly correct here.

**Why this is incorrect.** Marginal.

**Suggested direction.** None.

**OpenAPI impact.** None.

---

## Issue #62 — `tournament-openapi.spec.ts` Exists but Tests May Not Cover Drift

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament-openapi.spec.ts`

**Description.** The spec exists (referenced). It tests the schema. But the tests don't catch:

- The semantic drift in `getActiveTournaments` description.
- The capacity `TournamentFullError` 400 vs 409.
- The cross-tournament `startRoundAttempt` attack.

**Suggested direction.** Add spec assertions for the issues above.

**OpenAPI impact.** No change.

---

## Issue #63 — `tournament-shared-events.ts` Adapter's `subscribe` Method Adds to Local List, Never Removed (Resource Leak on Hot Reload)

**Severity:** Low
**Category:** Maintainability
**Location:** `shared-tournament-event-bus.adapter.ts:58-66`

**Description.** The unsubscribe returned by `subscribe` removes the handler. OK. But the `SharedTournamentEventBusAdapter` is provided as `SHARED_TOURNAMENT_EVENT_BUS` in the module — external consumers subscribe via this token. If a consumer subscribes in `onModuleInit` and the consumer module is reloaded (NestJS hot reload), multiple handlers may accumulate.

**Why this is incorrect.** Potential memory leak in dev mode.

**Suggested direction.** Document; use `OnModuleDestroy` to clear.

**OpenAPI impact.** No change.

---

## Issue #64 — `TournamentEventProcessor` Uses `Worker` Without `removeOnComplete` Config

**Severity:** Low
**Category:** Performance
**Location:** `tournament-event.processor.ts:46-70`

**Description.** The worker is created with `{ connection, concurrency }` but no `removeOnComplete`/`removeOnFail`. The default BullMQ behavior is to keep completed jobs forever. Over time, Redis fills with tournament events.

The publisher side has `removeOnComplete: { age: 86_400, count: 1_000 }` — so the queue won't accept new jobs past 1000 in 24h. But existing jobs in the worker's "completed" set may persist.

**Why this is incorrect.** Redis growth.

**Suggested direction.** Add `removeOnComplete: { age: 86_400, count: 1000 }` to the Worker options.

**OpenAPI impact.** No change.

---

## Issue #65 — `tournament-withdraw.spec.ts` Test "excludes withdrawn participant from ranking calculations" Calls `getMyTournamentStanding`, Not `withdrawFromTournament`

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament-withdraw.spec.ts:145-161`

**Description.** The test is in the `describe('TournamentService withdrawFromTournament')` block but tests `getMyTournamentStanding`. Misleading test placement.

**Suggested direction.** Move to a separate describe block.

**OpenAPI impact.** No change.

---

## Issue #66 — `TournamentEventProcessor` Re-Mints Correlation ID

**Severity:** Low
**Category:** Observability
**Location:** `tournament-event.processor.ts:113`

**Description.** `correlationId: createCorrelationId()` overrides the captured correlation. Trace chain breaks.

**Suggested direction.** Use `event.correlationId` from the job data, or the `correlationId` already restored into AsyncLocalStorage at line 56.

**OpenAPI impact.** No change.

---

## Issue #67 — `TournamentEventProcessor.handleEvent` Returns `Promise.resolve()` — Should Be No-Op `void`

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament-event.processor.ts:127`

**Description.** Trivial.

**Suggested direction.** Just `return;`.

---

## Issue #68 — `TournamentEventProcessor` Imports Sessions Config but Only Uses `tournamentQueueConcurrency`

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament-event.processor.ts:40-42`

**Description.** Fine, but should be injected only if needed.

---

## Issue #69 — `tournament.controller.ts` `getRelatedTournaments` Returns a Bare Array, Not the `ApiOkResource` Envelope

**Severity:** Low
**Category:** API Design
**Location:** `tournament.controller.ts:283-291` vs `tournament.presenter.ts:102-103`

**Description.** The presenter wraps `getRelatedTournaments` as `ApiResponse.ok([...items])` — i.e., `{ data: [...], meta: {...} }`. The other endpoints also use envelopes. OK, consistent.

But the `getRelatedTournaments` endpoint doesn't paginate — bare list. Compare with `getTournamentParticipants` which does paginate. Asymmetric API design.

**Suggested direction.** Add pagination or document.

**OpenAPI impact.** Document.

---

## Issue #70 — `tournament.controller.ts` `registerForTournament` Returns 200, Not 201

**Severity:** Low
**Category:** API Design
**Location:** `tournament.controller.ts:421-424`

**Description.** `ApiOkResource(...)` returns 200. But registration creates a participant row. RFC suggests 201 for resource creation.

But the controller method uses `@Post` and `@ApiOkResource` (200). Inconsistent with `createTournament` which uses `@ApiCreatedResource` (201).

**Suggested direction.** Use `@ApiCreatedResource` (201) for `registerForTournament`.

**OpenAPI impact.** Yes — change 200 to 201.

---

## Issue #71 — `startRoundAttempt` Returns 200 — Also a Creation

**Severity:** Low
**Category:** API Design
**Location:** `tournament.controller.ts:522-525`

**Description.** Same as #70.

**Suggested direction.** 201.

---

## Issue #72 — `unregisterFromTournament` (DELETE) Returns 200 With a Bare Message — Should Be 204 or 200 With No Body

**Severity:** Low
**Category:** API Design
**Location:** `tournament.controller.ts:564-567`

**Description.** Returns `{ message: '...' }` with 200. RFC suggests 204 for successful DELETE. The `tournament.presenter.ts:121` wraps it as `ApiResponse.ok({ message })` which is `{ data: {...}, meta: {...} }`.

**Suggested direction.** Use 204 No Content for unregister, or document the 200-with-message choice.

**OpenAPI impact.** Update description / status code.

---

## Issue #73 — `withdrawFromTournament` Returns 200 With a Message Body — Also a DELETE-like Operation

**Severity:** Low
**Category:** API Design
**Location:** `tournament.controller.ts:605-608`

**Description.** Same comment as #72. Returns 200 with body.

**Suggested direction.** Consistent.

---

## Issue #74 — `tournament.controller.ts` `registerForTournament` OpenAPI Says "404" for "Tournament not found" but Service Throws `TournamentNotFoundError` Which Maps to 404

**Severity:** Low
**Category:** Documentation
**Location:** `tournament.controller.ts:433`

**Description.** Consistent.

---

## Issue #75 — `tournament.dto.ts` `CreateTournamentDto` Does Not Validate `startAt` and `endAt` Are Valid ISO 8601 Timestamps

**Severity:** Medium
**Category:** Validation
**Location:** `tournament.dto.ts:218-230`

**Description.** `startAt!: string; endAt!: string;` — both `@IsString()` but no ISO 8601 format validation. A user can pass `"startAt": "tomorrow"` or `"startAt": "not-a-date"`.

The service does `new Date(payload.endAt) <= new Date(payload.startAt)`. `new Date("not-a-date")` returns `Invalid Date` which coerces to NaN. The comparison `NaN <= NaN` is false, so the check passes. The repository inserts the invalid date string, PG rejects.

**Why this is incorrect.** Validation missing; user gets 500 instead of 400.

**Suggested direction.** Add `@IsISO8601()` decorator or `@Matches(/^\d{4}-\d{2}-\d{2}T...Z$/)`.

**OpenAPI impact.** No change.

---

## Issue #76 — `tournament.dto.ts` `maxParticipants` Min Is 2, But a Tournament With `maxParticipants = 1` Could Be Created If the Schema Were Updated

**Severity:** Low
**Category:** Validation
**Location:** `tournament.dto.ts:241`

**Description.** `@Min(2)`. So 1 is rejected. But the schema allows 1 (CHECK: `max_participants > 0`). And a tournament with 1 participant is just a single-player round. Is it valid?

**Suggested direction.** Decide — if "1" is invalid (multi-player only), keep `@Min(2)` and document; if "1" is valid (e.g. personal challenge), change to `@Min(1)`.

**OpenAPI impact.** Update description.

---

## Issue #77 — `CreateTournamentDto.categoryId` Validates UUID but Does Not Verify Category Exists

**Severity:** Medium
**Category:** Validation / Data Integrity
**Location:** `tournament.dto.ts:250-251`

**Description.** `@IsUUID('7') categoryId?: string`. Validates UUID format, but not whether the category exists. The schema has `FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL`, so PG will reject. But:

- The error becomes 500.
- Categories can be soft-deleted (`deleted_at`); the tournament will retain the category_id, but the category is "gone".

**Why this is incorrect.** Validation gap; soft-deleted categories remain attached.

**Suggested direction.** Validate that the category exists and is not soft-deleted (return 400 if not).

**OpenAPI impact.** Add 400 case for invalid categoryId.

---

## Issue #78 — `getTournamentParticipants` Returns Soft-Deleted Users via `isNull(users.deletedAt)` Filter — Wait, It Does Filter

**Severity:** Low
**Category:** Data Integrity
**Location:** `tournament.repository.ts:1031`

**Description.** Filters `isNull(users.deletedAt)`. So soft-deleted users don't appear. Good. But the `JOIN` is `INNER JOIN users`, so a soft-deleted user with a `tournament_participants` row but no live `users` row (impossible due to FK) — actually the FK is `ON DELETE RESTRICT`, so deleting a user is hard-deleted (or blocked). Soft-delete via `users.deleted_at` is allowed.

OK, this works.

**Impact.** None.

---

## Issue #79 — `TournamentEventProcessor` Worker Runs Outside a Transaction — If a Handler Throws, the Worker Retries But the Tournament Lifecycle Has Already Advanced

**Severity:** Medium
**Category:** Event
**Location:** `tournament-event.processor.ts:46-70`, `bullmq-tournament-event-bus.service.ts:42-70`

**Description.** The BullMQ retry policy is `attempts: 3, backoff: { type: 'exponential', delay: 2_000 }`. So a failed XP publish is retried up to 3 times. After 3 failures, the job goes to "failed" and stays for 7 days (`removeOnFail: { age: 604_800, count: 5_000 }`).

Meanwhile, the tournament has been finalized (DB commit happened). The XP grant is lost.

**Why this is incorrect.** Failed XP grants don't trigger re-finalization.

**Suggested direction.** Persist `tournament_xp_grants` rows in the `finalizeTournament` transaction; the worker reads those rows and dispatches. If a row remains un-dispatched, retry.

**OpenAPI impact.** No change.

---

## Issue #80 — `getUpcomingTournaments` Sorts by `registrationDeadline` But There Is No `registrationDeadline` Column

**Severity:** High
**Category:** API Design / Documentation
**Location:** `tournament.repository.ts:198-199`, `tournament.dto.ts:99-106`

**Description.** The DTO accepts `sortBy: 'startAt' | 'registrationDeadline'`. The repository code at line 198-199:

```ts
const orderColumn =
  params.sortBy === 'registrationDeadline' ? tournaments.createdAt : tournaments.startAt;
```

So `sortBy='registrationDeadline'` actually sorts by `createdAt`, not by a registration deadline. There is no `registration_deadline` column on `tournaments`.

**Why this is incorrect.** Misleading sort option. Users expecting a registration deadline are getting creation date.

**Suggested direction.** Either:

- Add a `registration_deadline` column.
- Remove the `registrationDeadline` option.
- Document the actual behavior ("sorts by creation date when registrationDeadline is requested").

**OpenAPI impact.** Yes — update the description and possibly add `registration_deadline` column.

---

## Issue #81 — `TournamentEventProcessor` Uses Global Pino Logger Without Child Logger With Context

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament-event.processor.ts:38-43`

**Description.** The `PinoLogger` is injected via `@InjectPinoLogger(TournamentEventProcessor.name)`. Should be fine. But the log lines lack `tournamentId`/`userId` in most places (only in `tournament_xp_dispatched`).

**Suggested direction.** Add structured context.

**OpenAPI impact.** No change.

---

## Issue #82 — `TournamentListenerAdapter.handleTournamentWon` Does Not Pass `rank` to the Notification Port

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament-listener.adapter.ts:97-104`

**Description.** Calls `notifyTournamentWon` with `{ userId, tournamentId, tournamentTitle, prize }`. No `rank`. The notification may need to display "You won 1st place!" but lacks the rank.

**Suggested direction.** Pass `rank`.

**OpenAPI impact.** No change.

---

## Issue #83 — `TournamentListenerAdapter.handleTournamentCompleted` Does Not Pass `tournamentTitle` to `notifyTournamentCompleted`? Wait — It Does

**Severity:** Low
**Category:** Maintainability
**Location:** `tournament-listener.adapter.ts:122-145`

**Description.** Passes `tournamentTitle`. OK.

---

## Issue #84 — `tournament.service.ts` Does Not Use the `nowIso` From `withdrawFromTournament` to Recompute Stats

**Severity:** Low
**Category:** Counter Audit
**Location:** `tournament.service.ts:485-535`

**Description.** Already covered in #57.

---

## Issue #85 — `tournament.service.ts` `withdrawFromTournament` Allows Reactivation by Re-Withdrawing? No, It Throws AlreadyWithdrawn

**Severity:** Low
**Category:** Business Logic
**Location:** `tournament.service.ts:505-507`

**Description.** OK, throws.

---

## Issue #86 — `tournament-attempt-event-listener.adapter.ts` Does Not Update `tournament_rounds.status` to `running` or `finished` When Attempts Complete

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament-attempt-event-listener.adapter.ts:75-141`

**Description.** The round status (`pending`, `open`, `running`, `finished`) is never updated by the listener. There's no code path that transitions round status. So rounds are stuck in `pending` or `open` forever.

**Why this is incorrect.** Dead round lifecycle.

**Suggested direction.** Implement round lifecycle: when first attempt starts, set `running`. When all participants have completed, set `finished`. Or remove the round status column.

**OpenAPI impact.** Document.

---

## Issue #87 — `TournamentEventProcessor` Does Not Distinguish `tournament.completed` From `tournament.won` for XP — Wait, It Does

**Severity:** Low
**Category:** Event
**Location:** `tournament-event.processor.ts:99-128`

**Description.** `tournament.won` → XP. `tournament.completed` → no-op. OK.

---

## Issue #88 — `tournament.repository.ts` `refreshTournamentStats` Updates `participants` From `tournament_participants` But Filter Is Missing

**Severity:** Medium
**Category:** Counter Audit
**Location:** `tournament.repository.ts:480-505`

**Description.** The CTE in `refreshTournamentStats`:

```sql
COUNT(tp.participant_id)::int AS participants,
COUNT(CASE WHEN tp.rank_final IS NOT NULL THEN 1 END)::int AS completed_participants,
```

Counts ALL `tournament_participants` rows for the tournament, including `withdrawn` ones. So `participants` = total ever-registered, not active at finalization.

**Why this is incorrect.** Semantic confusion. Compare with `getTournamentStats` (line 432-446) which also counts all rows.

The DTO says `participants: 'Total registered participants'` — "registered" is ambiguous.

**Suggested direction.** Decide semantics. If `participants` = ever registered, document. If active at finalization, filter `status='active' OR status='completed'`.

**OpenAPI impact.** Update description.

---

## Issue #89 — `tournament_attempt_event_listener_adapter.ts` Reads `event.timeTakenMs` but Schema Says `time_taken_ms` — Already Mapped

**Severity:** Low
**Category:** Maintainability

**Description.** Fine.

---

## Issue #90 — `TournamentEventProcessor.handleEvent` Reads `event.rank` but Rank Comes From `TournamentWonEvent`, Not `TournamentCompletedEvent` — Code Checks `eventType === 'tournament.won'`

**Severity:** Low
**Category:** Maintainability

**Description.** OK.

---

## Issue #91 — `tournament_attempt_event_listener_adapter.ts` Updates `tournament_round_participants.updatedAt` Even When Round Score Is 0 (Did Not Answer)

**Severity:** Low
**Category:** Business Logic
**Location:** `tournament-attempt-event-listener.adapter.ts:107-117`

**Description.** Even if `scorePercent = 0` (participant didn't answer any question), the listener writes `roundScore=0, roundTimeMs=0`. The `JOINED` round_participant row exists but the participant never played.

**Why this is incorrect.** A zero-score attempt is indistinguishable from "joined but didn't attempt".

**Suggested direction.** Skip the update if `roundScore = 0`. Or document.

**OpenAPI impact.** No change.

---

## Issue #92 — `tournament-shared-events.ts` Adapter Drops `tournament.completed` and `tournament.starting_soon` — Duplicate With #37

**Severity:** Low
**Category:** Event
**Location:** `shared-tournament-event-bus.adapter.ts:85-103`

**Description.** Already covered.

---

## Issue #93 — `TournamentEventProcessor.handleEvent` Does Not Validate `event.userId` is a UUID

**Severity:** Low
**Category:** Validation
**Location:** `tournament-event.processor.ts:99-128`

**Description.** Accepts whatever is in the BullMQ job. If the job was tampered with (via direct Redis access), `event.userId` could be a non-UUID and the downstream `publishXpEarned` could fail.

**Suggested direction.** Validate.

**OpenAPI impact.** No change.

---

## Issue #94 — `finalizeDueTournaments` Limits to 100 Tournaments Per Cron Tick

**Severity:** Medium
**Category:** Performance / Scheduling
**Location:** `tournament-lifecycle.service.ts:110-114`

**Description.** `listCompletedTournaments({ page: 1, limit: 100, nowIso })`. If more than 100 tournaments are due for finalization in a single tick, the rest are deferred to the next 15-minute tick.

For a system with normal load this is fine. But during catch-up (after downtime), 100 may not be enough.

**Why this is incorrect.** Hidden bottleneck.

**Suggested direction.** Loop with pagination, or accept and document.

**OpenAPI impact.** No change.

---

## Issue #95 — `tournament.repository.ts` `getRoundDetailById` Returns `durationMs` Twice (One From `tournamentRounds`, One From `quizVersions`)

**Severity:** Medium
**Category:** Data Integrity
**Location:** `tournament.repository.ts:711-740`, `TournamentRoundDetailRow` at port 49-55

**Description.** The query selects `durationMs: tournamentRounds.durationMs` and `durationMs: quizVersions.durationMs`. Both are aliased `durationMs` — the second wins. The `TournamentRoundDetailRow` type only has one `durationMs` field. So the returned `durationMs` is from `quiz_versions`, NOT from `tournament_rounds.duration_ms`. This is silently overriding the round's duration with the quiz version's duration.

**Why this is incorrect.** Silent column override. The tournament round's duration (which could be a custom round time, e.g. "30 min for this round even though the quiz is 60 min") is lost.

**Impact.** Rounds with custom durations use the quiz version's duration instead.

**Suggested direction.** Rename one to `quizVersionDurationMs` or `roundDurationMs`.

**OpenAPI impact.** The response uses `durationMs` — clarify source.

---

## Issue #96 — `tournament_rounds.participantLimit` Is Read but Never Enforced

**Severity:** Medium
**Category:** Business Logic / Data Integrity
**Location:** `tournament.repository.ts:700, 725, 756` (reads), `tournament.service.ts` (no enforcement)

**Description.** The round's `participant_limit` is selected but no code path checks it. So a round with `participant_limit=10` can have 1000 round_participants.

**Why this is incorrect.** Dead constraint.

**Suggested direction.** Enforce in `startRoundAttempt` or remove the column.

**OpenAPI impact.** No change.

---

## Issue #97 — `tournament_rounds.isElimination` Is Read but Never Used to Eliminate Participants

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament.repository.ts:699, 724, 754` (reads), no elimination logic

**Description.** Dead feature. `is_elimination` round is supposed to disqualify participants who fail. No code does this.

**Suggested direction.** Implement or remove.

**OpenAPI impact.** No change.

---

## Issue #98 — `tournament_attempt_event_listener_adapter.ts` Writes `tournament_round_participants.round_score` But Does Not Update `rank_in_round`

**Severity:** Medium
**Category:** Business Logic
**Location:** `tournament-attempt-event-listener.adapter.ts:107-117`

**Description.** The `round_participants.rank_in_round` column exists (`TournamentRoundParticipantRow.rankInRound`) but is never written. So per-round rankings are unavailable.

**Suggested direction.** Compute `rank_in_round` after each attempt completion (SQL `ROW_NUMBER() OVER (PARTITION BY round_id ORDER BY round_score DESC, round_time_ms ASC)`).

**OpenAPI impact.** If a `round leaderboard` endpoint is added, document.

---

## Issue #99 — `TournamentRepository.getParticipantByUserAndTournament` Is Called Frequently With No Cache

**Severity:** Low
**Category:** Performance
**Location:** `tournament.repository.ts:569-596`

**Description.** Called in `registerForTournament`, `unregisterFromTournament`, `withdrawFromTournament`, `startRoundAttempt`. Each is a DB round-trip. For high-traffic tournaments, this is N round-trips per request.

**Suggested direction.** Cache for the duration of a request via CLS or use a Redis cache.

**OpenAPI impact.** No change.

---

## Issue #100 — `tournament.application.service.ts` `getTournamentById` Calls `getTournamentById` and `getTournamentRounds` in Sequence, Not Parallel

**Severity:** Low
**Category:** Performance
**Location:** `tournament.application.service.ts:257-268`

**Description.** Sequential await. Could be `Promise.all`.

**Suggested direction.** Parallelize.

**OpenAPI impact.** No change.

---

# PHASE GROUPING

## Phase 1 — Critical Authorization & Cross-Module Data Corruption

**Objective.** Stop users from poisoning other users' tournament data and from accessing admin-only operations.

**Implementation order:**

1. Add tournament ownership column (`owner_user_id`) + migration (#2).
2. Add admin endpoints: `PATCH /:id`, `DELETE /:id` (soft), `POST /:id/cancel` (#1, #7, #10).
3. Fix `startRoundAttempt` cross-tournament attack: verify `round.tournamentId === tournamentId` (#20, #31).
4. Add `TOURNAMENT_EDIT_OWN`/`TOURNAMENT_EDIT_ANY`/`TOURNAMENT_CANCEL` permissions (#1).

**Dependencies:**

- #2 (ownership column) before #1 (admin endpoints that reference ownership).
- #20/#31 (round-tournament check) before any other work — single-line fix.

**Estimated complexity:** Medium (1 migration + 3 new endpoints + policy).

**Breaking change risk:** Low (new endpoints, new column with default).

---

## Phase 2 — Concurrency, Idempotency & Race Conditions

**Objective.** Eliminate TOCTOU races in register/unregister/start-attempt/withdraw.

**Implementation order:**

1. Wrap `registerForTournament` in a transaction with `SELECT … FOR UPDATE` and `ON CONFLICT` (#3).
2. Wrap `unregisterFromTournament` in a transaction with similar protection.
3. Fix `startRoundAttemptTx` idempotency (#6, #50).
4. Fix `startRoundAttempt` race in the service layer (#6).
5. Fix reactivation capacity check (#4).
6. Add Redis advisory lock to all cron jobs (#8, #38).
7. Add idempotency key to `ExternalXpEarnedEvent` (#9).

**Dependencies:** None on Phase 1.

**Estimated complexity:** Medium-High (transactional rewrite of multiple service paths).

**Breaking change risk:** Low if idempotency keys are added in the event payload but the existing fields stay.

---

## Phase 3 — Event Reliability (Outbox & Idempotent Delivery)

**Objective.** Guarantee at-least-once delivery for tournament events; guarantee at-most-once XP grant.

**Implementation order:**

1. Introduce a `tournament_outbox_events` table (or reuse `outbox_events`).
2. Persist events inside the same DB transaction as the business write (#5).
3. Drain outbox via a worker (mirror `review-outbox-processor.service.ts`).
4. Remove the dual in-process + BullMQ delivery (#41).
5. Add idempotency key to XP events (#9).
6. Persist `tournament_xp_grants` table to dedupe XP (#9, #79).
7. Decide whether to enqueue no-op events (#32, #37).
8. Propagate correlation ID through the BullMQ worker (#66).

**Dependencies:** Phase 2 (transactional registration/withdrawal so outbox can be in the same tx).

**Estimated complexity:** High (new table, new worker, new failure modes).

**Breaking change risk:** Medium (consumers may need to handle new event shapes).

---

## Phase 4 — Business Logic & State Machine Integrity

**Objective.** Enforce lifecycle invariants; correct counter semantics.

**Implementation order:**

1. Implement tournament update/cancel endpoints with state-machine guards (#1, #26, #44).
2. Filter `status='upcoming'` in `listUpcomingTournaments`, `status='finished'` in `listCompletedTournaments`, etc. (#13, #14, #42).
3. Document counter semantics for `tournament_stats.participants`, `tournament-detail.totalParticipants`, `tournament_stats.averageScore` (#22-#25, #57, #88).
4. Compute `tournament_stats` aggregates from `tournament_round_participants`, not from cached counters (#23).
5. Validate `startAt`/`endAt` ISO 8601 format (#75).
6. Validate `categoryId` exists and is not soft-deleted (#77).
7. Reject registration when `startAt <= now` (#45).
8. Use `RANK()` instead of `ROW_NUMBER()` in `getParticipantStanding` (#30).
9. Implement or remove round lifecycle (`isElimination`, `participantLimit`, `rankInRound`, `isQualified`) (#96, #97, #98).
10. Add `totalParticipants` semantics clarification (#11, #25, #88).
11. Resolve the `registrationDeadline` sort option that maps to `createdAt` (#80).
12. Resolve the `tournamentRounds.durationMs` column conflict with `quizVersions.durationMs` (#95).
13. Add `registrationDeadline` column or remove the option (#80).

**Dependencies:** Phase 1 (state machine needs ownership).

**Estimated complexity:** Medium.

**Breaking change risk:** Medium (API responses may include new fields; some sorts may change).

---

## Phase 5 — API Design, Pagination & Performance

**Objective.** Bound every unbounded list; fix pagination correctness; improve performance.

**Implementation order:**

1. Add pagination to `getLeaderboard` (#28).
2. Cache `getRelatedTournaments` results (#27).
3. Batch `dispatchStartingSoonNotifications` notifications (#39).
4. Move all cron jobs to BullMQ delayed jobs (or single-leader scheduler) (#8, #38).
5. Fix `finalizeDueTournaments` status/state machine integrity (#40, #42).
6. Parallelize `getTournamentById` calls (#100).
7. Bound the `finalizeDueTournaments` pagination properly (#94).
8. Choose correct rank function for `getLeaderboard` (#29).
9. Add explicit `status` filter to `getActiveTournaments` (#12).
10. Cache `getParticipantByUserAndTournament` (#99).

**Dependencies:** None.

**Estimated complexity:** Medium.

**Breaking change risk:** Medium (some responses gain pagination).

---

## Phase 6 — Documentation & Cleanup

**Objective.** Bring OpenAPI in line with implementation; remove dead code.

**Implementation order:**

1. Update controller comments that describe wrong status codes (#17).
2. Update controller error descriptions (#18, #20, #53).
3. Change `registerForTournament` to `201 Created` (#70).
4. Change `startRoundAttempt` to `201 Created` (#71).
5. Change `unregisterFromTournament` and `withdrawFromTournament` to `204 No Content` or document 200-with-body (#72, #73).
6. Document `getActiveTournaments` semantics (#12).
7. Document `getUpcomingTournaments` semantics (#13).
8. Document `getCompletedTournaments` semantics (#14).
9. Document `listTournaments` default status filter (#16).
10. Update `getRelatedTournaments` description to match implementation (#53).
11. Update `tournament_stats` field descriptions (#22-#25, #57, #88).
12. Remove dead code: `in-memory-tournament-domain-event-bus.ts` (#36).
13. Remove suspicious type casts in `getRoundDetailById` (#35).
14. Fix `tournament-withdraw.spec.ts` test placement (#65).
15. Decide on dead round lifecycle columns (#96, #97, #98) — implement or remove.
16. Decide on `cancelled` enum value usage (#26, #44) — implement cancel or remove from enum.
17. Update `getLeaderboard` to expose `limit`/`offset` query params (#28).
18. Update `getRelatedTournaments` pagination docs (#69).

**Dependencies:** All previous phases.

**Estimated complexity:** Low.

**Breaking change risk:** Low (mostly description changes).

---

## Summary

The audit found **100 issues** across 6 categories:

- **Critical** (must-fix): #1, #2, #3, #5, #9, #20/#31, #38, #40, #50, #79, #80.
- **High** (recommended): #4, #6, #7, #8, #10, #11, #21, #26, #28, #43, #45, #46.
- **Medium**: #12-#19, #22-#25, #27, #29, #30, #32-#42, #44, #47, #49, #51, #57-#60, #62, #75, #77, #80-#82, #84-#98.
- **Low**: #41-#69, #71-#74, #76, #78, #83, #89-#93, #99-#100.

Several issues are **interconnected** (e.g., the registration race #3 and the reactivation race #4 share the same transaction wrap fix; the outbox #5 enables at-most-once XP #9; the cross-tournament attack #20 is the same code path as #31). Fixing one often addresses others.

The tournament lifecycle service relies on cron ticks that run every 5-15 minutes. Without distributed locking, multi-replica deployments will emit duplicate notifications and race on status transitions. This is the highest-impact operational issue alongside the cross-tournament data corruption in `startRoundAttempt`.

The OpenAPI documentation is partially drifted from implementation — particularly around `getActiveTournaments` semantics, the `registrationDeadline` sort option, the `TournamentFullError` status code, and the `startRoundAttempt` 400 vs 409 vs 403 distinction.
