# Instance Module Architecture Review

---

# Executive Summary

## Overall Score: 5.5/10

| Dimension | Score | Assessment |
|-----------|-------|------------|
| **Architecture** | 7/10 | Solid layered architecture with domain events, ports/adapters, clean separation of concerns. In-process event bus is a good starting point but won't scale. |
| **Product Design** | 3/10 | Missing critical multiplayer features. Countdown is absent (high priority). Solo play allowed despite being invalid per project assumptions. |
| **Domain Modeling** | 5/10 | Core entities are well-defined. `quizVersionId` leaks into API (Required Fix). State machine is underspecified. Player lifecycle transitions are not enforced. |
| **API Design** | 4/10 | Exposes `quizVersionId` in public API (Required Fix). Basic CRUD-style REST API. No versioning strategy. |
| **Scalability** | 3/10 | In-memory WebSocket state tracking, no distributed caching, leaderboard CTE is acceptable for small instances but will degrade at scale. Missing critical indexes. |
| **Maintainability** | 7/10 | Well-structured codebase with good TypeScript types, validation, error handling. Code is readable and tests exist. |
| **Extensibility** | 4/10 | Domain events provide hooks, but status is hardcoded enum limiting game modes. Tournament module duplicates patterns. |
| **Business Alignment** | 4/10 | Allows solo play (invalid per assumptions). Missing countdown (high priority). Lacks safeguards for common multiplayer scenarios (host abandon, room full race, reconnection). |

---

# Major Strengths

1. **Clean Architecture Layers**: Domain service → Application service → Controller/Gateway separation is well-executed.

2. **Domain Events**: Event-driven design with `InstanceDomainEventBus` allows cross-module integration (notifications, achievements, social feed) without tight coupling.

3. **Atomic Join**: `joinInstanceAtomic` uses a transaction with proper unique constraint fallback for duplicate prevention.

4. **Cursor Pagination**: Leaderboard and instance list use proper cursor pagination with base64url encoding.

5. **Defensive Validation**: Constraints defined at both DTO (class-validator) and database (CHECK constraints) layers.

6. **Leaderboard Ranking**: Uses window function with tiebreakers for deterministic ordering.

7. **Problem Details**: RFC 7807 error responses with machine-readable codes.

---

# Major Weaknesses

1. **Non-Atomic Status Transitions** (Required Fix): `startInstance` reads status, then updates it. No optimistic locking. Double-start race condition exists.

2. **`quizVersionId` in Public API** (Required Fix): Per project assumptions, `quizVersionId` is internal. Exposing it in request/response DTOs violates the business concept boundary.

3. **Missing Concurrency Guards** (Required Fix): Room capacity check and insert are not atomic. Concurrent joins can exceed `maxPlayers`.

4. **Solo Play Allowed** (Required Fix): Per project assumptions, Instance is strictly multiplayer. `startInstance` has no minimum player validation. Starting with 1 player is invalid but possible.

5. **Player Status Transitions Not Enforced**: `InstancePlayer` statuses are stored but domain doesn't validate valid transitions (e.g., `ready` → `joined` is allowed).

6. **Documentation/Code Mismatch**: Docs say `started`, code uses `running`.

7. **Countdown Not Modeled as Lifecycle State** (High Priority): Per project assumptions, countdown is part of the core multiplayer experience. The current state machine transitions directly from OPEN to RUNNING without an explicit countdown phase. This creates ambiguity around player join timing, host cancellation, and event ordering during game start.

---

# Product Review

## The API from a User's QuizApp Perspective

### `POST /instances` - Create Instance

**Request**: `{ quizVersionId: "uuid", maxPlayers?: number }`

**Problems**:

1. **`quizVersionId` is a Required Fix** — Per project assumptions, `quizVersionId` is an internal implementation detail. Users think in terms of "quizzes" not "quiz versions". Exposing `quizVersionId` in the public API is an architecture flaw that MUST be fixed.

   **Required Fix**: Change to accept `quizId` and resolve to the latest published version server-side.

2. **No room visibility setting** — Users cannot choose public/private. There's no concept of a private room with an invite code.

3. **No minimum players** — A host can start a game with just themselves, which is a single-player experience with extra steps.

4. **`maxPlayers` default is unlimited** — There's no sensible default. What does "unlimited" mean for WebSocket connections?

### `GET /instances` - List Instances

**Problems**:

1. **Returns `quizVersionId` and `versionNumber`** — Per project assumptions, these are internal. Response should only expose `quizId`.

2. **No search** — Users cannot search for rooms by name.

3. **`creatorId` filter exists but frontend has no way to browse by creator** — Orphaned filter.

### `POST /instances/{id}/join` - Join Instance

**Problems**:

1. **No invite code support** — Private rooms with passwords don't exist.

2. **No validation that quiz is still available** — If the quiz was archived after the room was created, the room is orphaned.

3. **Late join to running instance** — The code blocks joins when `status !== 'open'`, but a product manager might want `running` instances to allow late join with a time penalty.

### `POST /instances/{id}/start` - Start Instance

**Problems**:

1. **No countdown** — Per project assumptions, countdown is part of the core multiplayer experience. After host starts, players should have a short countdown (3–5 seconds) before the first question appears. Immediate transition from OPEN to RUNNING without countdown is a **High Priority Recommendation**.

2. **No minimum player check** — Per project assumptions, Instance is strictly multiplayer. Solo play is NOT supported. Starting with only one player is invalid. This is a **Required Fix**.

### `POST /instances/{id}/close` - Close Instance

**Problems**:

1. **No early close reason** — If the host closes early (cheating, technical issues), there's no way to communicate that to players.

2. **No grace period** — If a player is mid-question, closing immediately abandons them.

### WebSocket Events

**Problems**:

1. **`question_revealed` has no data** — It only broadcasts question numbers, not the question content itself. How does the client know what question to display?

2. **`answer_submitted` is fire-and-forget** — No validation, no acknowledgment, no attempt creation. The handler just logs and returns `ack`.

3. **`update_leaderboard` does nothing** — Returns `ack` without actually pushing leaderboard data.

4. **`end_game` does nothing** — Returns `ack` without transitioning state to `finished`.

5. **No `player_ready` event** — The `ready` status in the player state exists but there's no WebSocket event for it.

---

# Business Workflow Review

## Instance State Machine

### Current Implementation (Code)

```
OPEN ──────► RUNNING ──────► CLOSED
  │                             │
  └─────────────────────────────┴──────► FINISHED
```

### Current Documentation (docs/modules/instance.md)

```
Open (status = open)
    ↓ startInstance() [host only]
Started (status = started)
    ↓ closeInstance() [host only]
Closed (status = closed)
```

**Mismatch**: Documentation says `started`, code uses `running`.

### Recommended State Machine (with Countdown)

Per project assumptions, countdown is part of the core multiplayer experience. The state machine should include an explicit COUNTDOWN state:

```
OPEN ──────► COUNTDOWN ──────► RUNNING ──────► FINISHED
  │              │
  └──────────────┴──────► CLOSED (host cancels)
```

## State Definitions

| State | Meaning | Who Can Transition |
|-------|---------|-------------------|
| `open` | Room exists, accepting players | Host → `countdown` |
| `countdown` | Waiting for game start | Host → `open` (cancel), Scheduler → `running` (complete) |
| `running` | Game in progress | System → `finished` |
| `closed` | Host ended session | — (terminal) |
| `finished` | All players completed | — (terminal) |

## Countdown Review Questions

### 1. Can players join during countdown?

**Current**: Unknown. The code transitions directly from `open` to `running`. If countdown is added, the design must specify whether players can join during the countdown phase.

**Recommendation**: Decide based on product requirements:
- If players can join during countdown, update capacity checks accordingly
- If players cannot join, block joins when status = `countdown`

### 2. Can the host cancel countdown?

**Current**: Not modeled.

**Recommendation**: Add `cancelCountdown()` method. Host transitions from `countdown` back to `open`. Emit `countdown_cancelled` event.

### 3. What happens if the host disconnects during countdown?

**Current**: `handleDisconnect` emits `PlayerDisconnectedEvent` but takes no action on the instance state.

**Recommendation**: Design must specify:
- Does countdown continue without host?
- Does countdown auto-cancel?
- Can another player be promoted to host?

### 4. What if everyone leaves during countdown?

**Recommendation**: If all players disconnect during countdown, cancel the countdown and return to `open`.

### 5. Can countdown be restarted?

**Recommendation**: Allow host to restart countdown from `open` state if they cancelled it.

### 6. How are duplicate countdown events prevented?

**Current**: No mechanism.

**Recommendation**: Add idempotency key to countdown start. If countdown is already running, reject subsequent start requests.

### 7. Who owns the countdown timer?

**Recommendation**: Domain Service owns the countdown lifecycle. WebSocket gateway emits countdown tick events. Scheduler or setTimeout handles the completion.

## Missing Transitions

### 1. `open` → `closed` without starting
**Scenario**: Host creates room, waits 10 minutes, no one joins, host closes.

**Current**: Works.

### 2. `running` → `finished`
**Scenario**: All players complete their attempts. Who triggers this?

**Current**: Unknown. There's no `finishInstance()` endpoint. The `finished` status exists but nothing sets it.

### 3. `running` → `closed` by scheduler (timeout)
**Scenario**: Quiz has 30-minute duration. If players take longer, what happens?

**Current**: No scheduler exists in the Instance module. The `startedAt` and `closedAt` fields exist but aren't used for timeouts.

### 4. Player states are independent of instance state
**Scenario**: Player disconnects during `running`. Their status becomes `disconnected`. Instance continues. Player reconnects. Their status can become `ready` but not `playing` (rejoin attempt).

**Problem**: The `ready` status is confusing. Why would a disconnected player reconnect as `ready` instead of rejoining the game?

---

## Player State Machine (Documentation)

```
Joined (status = joined)
    ↓ player starts attempt
Playing (status = playing)
    ↓ player disconnects
Disconnected (status = disconnected)
    ↓ player reconnects
Ready (status = ready)
    ↓ result recorded
Finished (status = finished)
```

**Problems**:

1. **No domain enforcement** — The code stores any status update without validating transitions.

2. **`ready` status is ambiguous** — In what state is a player `ready`? Before the game starts? After reconnecting?

3. **No explicit transition from `disconnected` back to `playing`** — If a player reconnects mid-game, how do they rejoin? The only path is `ready`.

4. **`joined` → `playing` happens implicitly** — When does this occur? The `InstanceAttemptEventBootstrapService` links attempts to players, but there's no explicit status transition.

---

# Domain Review

## Entity: QuizInstance

```typescript
type QuizInstance = {
  instanceId: string;
  quizVersionId: string;  // ⚠️ Internal only — do not expose to API
  hostUserId: string;
  maxPlayers: number | null;
  status: 'open' | 'running' | 'closed' | 'finished';
  createdAt: string;
  startedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
};
```

### Aggregate Boundary

The `QuizInstance` aggregate is reasonable — it owns the instance lifecycle and player membership. However, `quizVersionId` must not be exposed through the public API (per project assumptions).

### Missing Fields

- `visibility`: public/private (for future)
- `inviteCode`: For private rooms (for future)
- `settings`: JSON blob for game-specific settings (countdown duration, late join penalty, etc.)
- `closedReason`: Why the host closed (optional)

### Invariants

✅ **Host is immutable** — Once set, `hostUserId` never changes. If the host leaves, the room is stuck.

❌ **No host transfer** — What happens if the host wants to leave? The room is orphaned.

## Entity: InstancePlayer

```typescript
type InstancePlayer = {
  instancePlayerId: string;
  instanceId: string;
  userId: string;
  attemptId: string | null;
  status: 'joined' | 'ready' | 'playing' | 'disconnected' | 'finished';
  joinedAt: string;
  leftAt: string | null;
};
```

### Missing Fields

- `isHost`: Explicit flag or derived from hostUserId
- `scoreRank`: Denormalized for fast leaderboard
- `reconnectToken`: For secure reconnection (for future)

### Lifecycle Ownership

The `InstanceService` owns state transitions. However:

1. `updatePlayerStatus` is public on the repository without domain validation.
2. The `InstanceAttemptEventBootstrapService` sets player status to `playing` based on external events, but there's no domain-level guard ensuring the player is in a valid state.

---

# API Review

## Request DTO: `CreateInstanceDto`

```typescript
class CreateInstanceDto {
  @IsUUID('7')
  quizVersionId!: string;  // ⚠️ Required Fix: must be quizId, not quizVersionId

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;
}
```

**Issues**:

1. **`quizVersionId` must be `quizId`** — Per project assumptions, `quizVersionId` is an internal implementation detail. The API MUST accept `quizId` and resolve to the latest published version server-side.

2. **`maxPlayers` minimum of 2** — Per project assumptions, Instance is strictly multiplayer. Consider making this required with minimum of 2.

## Response DTO: `InstanceDetailResponseDto`

```typescript
class InstanceDetailResponseDto {
  instanceId!: string;
  quizVersionId!: string;   // ⚠️ Required Fix: remove from public API
  hostUserId!: string;
  hostUsername!: string;
  hostDisplayName!: string | null;
  maxPlayers!: number | null;
  status!: QuizInstanceStatus;
  versionNumber!: number;   // ⚠️ Required Fix: internal implementation detail
  difficulty!: QuizDifficulty;
  durationMs!: number;
  passingScorePercent!: number;
  rewardXp!: number;
  quizId!: string;
  quizTitle!: string;
  quizSlug!: string;
  createdAt!: string;
  startedAt!: string | null;
  closedAt!: string | null;
  updatedAt!: string;
  players!: InstancePlayerResponseDto[];
}
```

**Issues**:

1. **`quizVersionId` and `versionNumber` must be removed** — Per project assumptions, `quizVersionId` is internal. Frontend only needs `quizId` and `quizTitle`.

2. **Too many fields** — Frontend needs: `instanceId`, `status`, `quizTitle`, `quizSlug`, `hostUsername`, `playerCount`, `maxPlayers`, `createdAt`.

3. **`players` includes all players even after disconnect** — Should separate "active" from "disconnected" players.

## HTTP Status Code Analysis

| Endpoint | Success | Error Cases | Issues |
|----------|---------|-------------|--------|
| `POST /instances` | 201 | 400, 401, 404 | 404 for missing quiz version is wrong HTTP code |
| `GET /instances` | 200 | 400, 401 | OK |
| `GET /instances/{id}` | 200 | 400, 401, 404 | OK |
| `GET /instances/{id}/players` | 200 | 400, 401, 404 | OK |
| `POST /instances/{id}/join` | 200 | 400, 401, 404, 409 | 409 for duplicate join is correct |
| `POST /instances/{id}/start` | 200 | 400, 401, 403, 404 | 403 for non-host is correct |
| `POST /instances/{id}/close` | 200 | 400, 401, 403, 404 | OK |
| `GET /instances/{id}/leaderboard` | 200 | 400, 401, 404 | OK |

**Issue**: `POST /instances` returns 404 when `quizVersionId` doesn't exist. 404 is for "resource not found." A missing version is a 400 Bad Request (user error in selection) or 422 Unprocessable Entity. **Note**: This will be addressed when `quizVersionId` is replaced with `quizId`.

---

# Concurrency Review

## 1. Room Capacity Race Condition

**Scenario**: Room has `maxPlayers = 5`. Currently 4 players. Two players try to join simultaneously.

**Code Path**:

```typescript
// joinInstanceAtomic
const [{ count: currentCount }] = await db
  .select({ count: count() })
  .from(quizInstancePlayers)
  .where(and(
    eq(quizInstancePlayers.instanceId, params.instanceId),
    eq(quizInstancePlayers.status, 'joined'),  // ⚠️ Not in transaction scope
  ));

if (currentCount >= params.maxPlayers) {
  throw new Error('INSTANCE_FULL');
}

const [player] = await db
  .insert(quizInstancePlayers)  // ⚠️ Separate statement
  .values({...});
```

**Problem**: Between the `SELECT count` and `INSERT`, another player could join, making the count 5. Both inserts succeed, resulting in 6 players.

**Fix**: Use `SELECT ... FOR UPDATE` or a single conditional INSERT with a trigger.

## 2. Double-Start Race Condition

**Scenario**: Host taps "Start Game" twice quickly on a slow network.

**Code Path**:

```typescript
// startInstance
const instance = await this.instanceRepository.getInstanceById(instanceId);
if (instance.status === 'running') {
  throw new InstanceAlreadyStartedError();
}
await this.instanceRepository.updateInstanceStatus({...});  // ⚠️ No optimistic lock
```

**Problem**: Two concurrent requests both read `status = 'open'`, both pass the check, both update to `running`.

**Fix**: Add optimistic locking with a version column, or use `UPDATE ... WHERE status = 'open' RETURNING *` and check affected rows.

## 3. In-Memory Socket Tracking

**Scenario**: Application runs on 3 instances behind a load balancer. Player connects to Instance A. Host starts game on Instance B. Instance A doesn't receive the event.

**Code Path**:

```typescript
// InstanceApplicationService
private readonly socketIdToMeta = new Map<string, {...}>();
```

**Problem**: `socketIdToMeta` is in-memory. Distributed Socket.IO requires Redis adapter for room state.

## 4. Host Disconnect During Game

**Scenario**: Host is playing the quiz but has bad connection. Their socket disconnects. Game continues for other players. Host rejoins.

**Code Path**: `handleDisconnect` emits `PlayerDisconnectedEvent` but takes no action on the instance state.

**Problem**: If the host disconnects, who controls the game? There's no mechanism to transfer host or continue without them.

## 5. Multiple Browser Tabs

**Scenario**: User opens room in two tabs. Both tabs call `joinInstance`. First succeeds. Second returns 409.

**Current**: 409 Conflict is returned, which is correct behavior. However, the user experience is confusing — which tab is "in" the game?

**Missing**: No mechanism to detect or prevent multiple sessions from the same user in the same instance.

## 6. Event Ordering

**Scenario**: Player disconnects, immediately reconnects (network flap). The `PlayerDisconnectedEvent` and `PlayerJoinedEvent` may arrive out of order.

**Current**: No sequence numbers or idempotency keys on events.

---

# Scalability Review

## Database Indexes

### Good

```sql
-- quiz_instance_players
index('idx_quiz_instance_players_instance_status')  -- (instanceId, status) ✓
unique('uq_quiz_instance_players_instance_user')    -- (instanceId, userId) ✓
index('idx_quiz_instance_players_attempt_id')        -- For linking attempts ✓

-- quiz_instances
index('idx_quiz_instances_host_status')             -- (hostUserId, status) ✓
index('idx_quiz_instances_version_status')          -- (quizVersionId, status) ✓
```

### Missing

```sql
-- List open instances (browse) — needs compound index
-- (status, createdAt DESC) for efficient public room listing

-- Leaderboard for instance — needs index on (instanceId, score DESC, timeTakenMs ASC)
-- Current CTE works but could benefit from covering index

-- User's active instances — (userId, status) for "my active games"
```

## Leaderboard Query Analysis

```sql
-- Current: CTE with window function
WITH ranked AS (
  SELECT ..., row_number() OVER (ORDER BY score DESC, timeTakenMs ASC, ...)
  FROM quiz_instance_players
  JOIN ...
)
SELECT * FROM ranked WHERE instanceId = ? ORDER BY rowRank;
```

**Assessment**: For instances with < 100 players, this is fast (< 10ms). For 1000 players, still acceptable (< 50ms). For 10,000 players in a single instance (unlikely but possible in a "live event" scenario), consider pre-computing rankings.

## WebSocket Scalability

**Current**: Single-instance Socket.IO with in-memory room tracking (`socketIdToMeta` Map).

**Assessment**: Works correctly for single-instance deployments. For horizontal scaling, Redis adapter and distributed state are required.

**At 10,000 concurrent users** (single instance):
- Assume 2,000 instances, avg 5 players each
- `socketIdToMeta` = 10,000 entries ~ 1-2 MB — acceptable

**For multi-instance deployment** (Production Deployment Requirement):
1. Redis adapter for Socket.IO
2. Redis pub/sub for cross-instance events
3. Move `socketIdToMeta` to Redis with TTL

## Pagination

**Instance List**: Cursor-based ✓, defaults to 20 ✓
**Leaderboard**: Cursor-based ✓, defaults to 20 ✓
**Player List**: No pagination, returns all players. For 100+ player rooms, this could be slow.

---

# Final Verdict

## Merge Immediately

### 1. Add Optimistic Locking on Status Transitions

**File**: `src/modules/instance/domain/instance.service.ts`, `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts`

**Changes**: Add `version` column to `quiz_instances`, use in WHERE clause for updates.

**Risk if not merged**: Race condition causing double-start. **Severity**: Critical.

### 2. Atomic Capacity Check

**File**: `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts`

**Changes**: Use `SELECT FOR UPDATE` or conditional INSERT within the transaction.

**Risk if not merged**: Business invariant violation (room over capacity). **Severity**: Critical.

### 3. Fix Documentation/Code Status Mismatch

**File**: `docs/modules/instance.md`

**Changes**: Change documentation to use `running` instead of `started`.

**Risk if not merged**: Developer confusion. **Severity**: Low.

### 4. Change `quizVersionId` to `quizId` in Public API

**File**: `src/modules/instance/dto/request/instance.dto.ts`, response DTOs

**Changes**: Per project assumptions, `quizVersionId` is internal. Replace with `quizId` in `CreateInstanceDto`. Resolve to latest published version in domain service.

**Risk if not merged**: Exposes implementation detail. Frontend must understand versioning. **Severity**: High.

### 5. Add Minimum Player Validation

**File**: `src/modules/instance/domain/instance.service.ts`

**Changes**: Per project assumptions, Instance is strictly multiplayer. Add validation in `startInstance` to reject if fewer than 2 players have joined.

**Risk if not merged**: Allows invalid solo play. **Severity**: High.

### 6. Model Countdown as Lifecycle State

**File**: State machine, domain service, WebSocket gateway

**Changes**: Per project assumptions, countdown is part of the core multiplayer experience. Add `countdown` as an explicit lifecycle state with transitions to/from `open` and `running`.

**Review Questions to Resolve**:
- Can players join during countdown?
- Can the host cancel countdown?
- What happens if the host disconnects during countdown?
- Who owns the countdown timer (Domain Service, Scheduler, or WebSocket)?
- How are duplicate countdown events prevented?

**Risk if not merged**: State machine does not model the core multiplayer experience correctly. **Severity**: High.

---

## Future Roadmap

### Distributed WebSocket State (Redis Adapter)

When deploying with multiple instances.

### Invite Codes / Private Rooms

Private rooms with shareable codes are standard in multiplayer apps.

### Spectator Mode

Non-players may want to watch the game.

### Reconnection Token

Secure reconnection after network drop.

### Room Expiration / Timeout

Orphaned rooms (host creates then abandons) waste resources.

### Kick Player

Host may need to remove disruptive players.

### Team Mode

Players could be grouped into teams.

---

## Reject

### Voice Chat

WebRTC integration is complex and not in current scope.

### Bot Players

AI behavior simulation is out of scope.

---

# Summary of Required Actions Before Production

1. **Fix race conditions** (double-start, capacity overflow) — Non-negotiable
2. **Change API to use `quizId`** — Internal implementation detail must not leak
3. **Add minimum player validation** — Solo play is invalid per project assumptions
4. **Model countdown as lifecycle state** — Core multiplayer experience requirement
5. **Move socket state to Redis** — Production deployment requirement (horizontal scaling)

---

# Architecture Debt Summary

| Issue | Severity | Effort | Category |
|-------|----------|--------|----------|
| Double-start race | Critical | Low | Required Fix |
| Capacity overflow race | Critical | Low | Required Fix |
| `quizVersionId` in API | High | Low | Required Fix |
| Solo play allowed | High | Low | Required Fix |
| Countdown not modeled as lifecycle state | High | Medium | Required Fix |
| Distributed socket state | Medium | Medium | Production Deployment |
| Missing host transfer | Medium | Medium | Product Discussion |

---

# Implementation Plan

This plan is derived exclusively from the findings above. No new recommendations are introduced.

## Dependency Analysis

The Required Fix items have the following relationships:

| Task | Depends On | Unblocks | Same Code Area |
|------|-----------|----------|----------------|
| Optimistic locking | — | Capacity check (atomic transition relies on version field pattern) | `quiz_instances` table |
| Atomic capacity check | Optimistic locking pattern (parallel-safe) | — | Player join repository |
| `quizId` API refactor | — | Removes `quizVersionId` from response DTOs, list endpoint | Request/response DTOs |
| Minimum player validation | — | Countdown transition (both gate `startInstance`) | `startInstance` domain method |
| Countdown lifecycle state | Minimum player validation, DTO fix (events carry `quizId` not `quizVersionId`) | State machine stabilization | State enum, WebSocket events |
| Distributed socket state | Countdown lifecycle state (events must be reliably emitted across nodes) | — | WebSocket gateway, `socketIdToMeta` |
| Host transfer | Countdown lifecycle state (host ownership during countdown) | — | Player domain, event handlers |

Key insights:

- **Optimistic locking and `quizId` API refactor are independent** — they touch disjoint code areas (DB schema vs DTOs).
- **Minimum player validation and countdown lifecycle state both modify `startInstance`** — sequencing matters.
- **Distributed socket state depends on the WebSocket event surface being finalized** — countdown events must exist before distributed emission is meaningful.
- **Host transfer is the final piece** — it requires the countdown state machine to be stable so host-absence behavior during countdown can be properly defined.

## Dependency Graph

```
Optimistic Locking ─────┐
                         ├──► Atomic Capacity Check
quizId API Refactor ─────┤
                         │
Minimum Player Validation┤
                         │
                         ▼
              Countdown Lifecycle State
                         │
                         ▼
              Distributed Socket State
                         │
                         ▼
              Host Transfer (Product Discussion)
```

Three work streams are independent and parallelizable:

```
Stream A: Optimistic Locking → Atomic Capacity Check
Stream B: quizId API Refactor
Stream C: Minimum Player Validation → Countdown Lifecycle State
```

Stream A and B converge when Stream C completes (all needed before distributed socket state).

## Implementation Phases

### Phase 1 — Foundational Correctness

**Goal**: Eliminate correctness bugs that violate business invariants before adding new behavior.

**Why these tasks belong together**: All three are independent, low-effort Required Fixes that block any further development. They share the property that without them, the system can reach invalid states (double-start, over-capacity rooms, solo play, internal details leaking).

**Items**:
- Optimistic locking on status transitions (double-start race)
- Atomic capacity check on join
- `quizVersionId` → `quizId` API refactor

**Dependencies**: None. These are foundational and modify disjoint areas (DB column, repository transaction, DTOs).

**Risks**:
- Adding `version` column requires a database migration — coordination with deployment
- DTO change is a breaking API change — frontend must be updated in lockstep or versioned

**Parallel work**: Yes — three developers can work simultaneously on the three items.

**Expected deliverables**:
- New `version` column on `quiz_instances`, optimistic update queries
- `SELECT ... FOR UPDATE` or conditional INSERT for capacity check
- `CreateInstanceDto` accepts `quizId`; response DTOs expose `quizId` only
- Tests proving race conditions no longer reproduce

### Phase 2 — Gameplay Lifecycle

**Goal**: Introduce the COUNTDOWN lifecycle state and enforce minimum player requirements.

**Why these tasks belong together**: Both gate `startInstance`. Minimum player validation is the precondition for countdown to make sense (you need ≥2 players before starting a countdown). Together they form the minimum viable multiplayer lifecycle. Both must be complete before host-absence during countdown can be evaluated.

**Items**:
- Minimum player validation in `startInstance`
- Countdown as explicit lifecycle state with transitions and event emission

**Dependencies**:
- `quizId` API refactor must be done first — countdown events must reference `quizId`, not `quizVersionId`
- Phase 1 optimistic locking pattern (countdown transition is a status change requiring atomic update)

**Risks**:
- Countdown timer ownership (Domain Service vs Scheduler vs WebSocket) must be decided before implementation
- Countdown cancellation semantics (can host cancel? what if host disconnects?) are unresolved questions in the review — must be answered before coding

**Parallel work**: The two items partially overlap — minimum player validation should land first as a small prerequisite, then countdown implementation begins. They cannot be fully parallelized because both modify `startInstance`.

**Expected deliverables**:
- `startInstance` rejects when <2 players joined
- New `countdown` status value in state enum
- `startCountdown`, `cancelCountdown` domain methods
- `countdown_started`, `countdown_cancelled`, `countdown_completed` WebSocket events
- Idempotency key on countdown start to prevent duplicate events

### Phase 3 — Production Deployment Readiness

**Goal**: Enable horizontal scaling by distributing WebSocket state.

**Why this task belongs after Phase 2**: The WebSocket event surface must be finalized (countdown events included) before distributing the emission infrastructure. Implementing Redis-backed state on a moving event surface is wasted work.

**Items**:
- Distributed socket state (Redis adapter)
- Move `socketIdToMeta` to Redis with TTL
- Redis pub/sub for cross-instance events

**Dependencies**:
- Phase 2 complete (countdown events stabilized)
- Infrastructure: Redis instance provisioned

**Risks**:
- Redis becomes a hard dependency for the application
- TTL tuning affects reconnection behavior — must align with reconnection window when implemented

**Parallel work**: Once Phase 2 is complete, this can be done by a single developer or team.

**Expected deliverables**:
- Socket.IO Redis adapter configured
- `socketIdToMeta` moved to Redis
- Cross-instance event delivery validated via integration tests
- Operational runbook for Redis deployment

## Critical Path

The critical path to production readiness is:

```
Phase 1: Optimistic Locking → Atomic Capacity Check
    ↓
Phase 2: Minimum Player Validation → Countdown Lifecycle State
    ↓
Phase 3: Distributed Socket State
```

Every item on this path must be completed before production. Skipping any of them leaves a correctness or scalability gap:

- Skipping optimistic locking → double-start race remains exploitable
- Skipping minimum player validation → invalid solo play allowed (violates business assumption)
- Skipping countdown → core multiplayer experience is broken
- Skipping distributed state → application cannot horizontally scale beyond one node

The `quizId` API refactor (Phase 1) is parallel to the critical path and can be completed at any point before frontend integration.

## Parallel Work Summary

The following work can be done concurrently by different developers:

| Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|
| Optimistic locking | (must follow Phase 1) | (must follow Phase 2) |
| Atomic capacity check | | |
| `quizId` API refactor | | |

In Phase 1, three developers can work in parallel on three independent files/areas. In Phase 2, work is sequential because both items modify `startInstance`. In Phase 3, work is sequential because it depends on Phase 2 stabilization.

## Deferred Work

The following items from the review can safely be postponed:

| Item | Reason for Deferral |
|------|---------------------|
| Distributed socket state (single-instance deployment) | If deploying on a single instance, in-memory socket tracking is correct and sufficient. |
| Host transfer | Classified as Product Discussion in the review. The room being orphaned is a product decision, not a correctness issue. The Instance module can ship without it. |
| Future Roadmap items (invite codes, spectator mode, reconnection token, room expiration, kick player, team mode) | Not required for production. All are explicitly future work. |

Deferring these items does not compromise correctness or production readiness. They are improvements that can be scheduled based on product priorities after the critical path is complete.

