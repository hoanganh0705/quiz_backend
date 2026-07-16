# Tournament Module

## Purpose

Owns the **competitive quiz event lifecycle**: tournament creation, registration phases, round management, live leaderboards, and scheduled lifecycle transitions (BullMQ-based).

## Responsibilities

**Owns**
- Tournament catalog and lifecycle management (upcoming → registration → ongoing → finished)
- Player registration and withdrawal
- Round management and results recording
- Leaderboard computation
- Scheduled lifecycle transitions via BullMQ

**Does not own**
- Individual attempt tracking (Attempt module)
- XP/ranking (Ranking module)
- Badges (Achievement module)

## Core Concepts

| Concept | Description |
|---|---|
| **Tournament** | An event: `title`, `description`, `quizId`, `startAt`, `endAt`, `status ∈ {upcoming, registration, ongoing, finished}`, `maxParticipants`. |
| **TournamentParticipant** | A user's registration: `status ∈ {active, withdrawn, completed}`, `registeredAt`. |
| **TournamentRound** | A round within a tournament with `status ∈ {pending, open, running, finished}`. |

## Business Rules

- **End after start**: `endAt` must be after `startAt`.
- **Registration window**: registration only accepted when `status = registration`.
- **Withdraw window**: withdrawal only allowed when `status = ongoing`.
- **Unregister window**: unregistration only allowed when `status = registration`.
- **Capacity cap**: registration fails when `maxParticipants` is reached.
- **Re-registration**: withdrawing then re-registering reactivates the participant record.
- **Leaderboard**: computed from participant results. Excludes withdrawn participants.

## Pagination Strategy

The tournament module uses two pagination strategies based on endpoint requirements:

| Strategy | Endpoints | Use Case |
|----------|-----------|----------|
| **Cursor** | `/tournaments` (list) | Infinite scroll, stable ordering with cursor-based navigation |
| **Offset** | `/tournaments/upcoming`, `/tournaments/active`, `/tournaments/completed`, `:id/participants` | Page-by-page navigation with known total counts |

**Cursor pagination** returns `nextCursor` for stable navigation in real-time feeds.
**Offset pagination** returns `page`, `total`, and `hasMore` for traditional page navigation.

### Sorting Options

| Endpoint | Sort Options | Default |
|----------|-------------|---------|
| `/tournaments` | `createdAt` (cursor-based) | `createdAt` desc |
| `/tournaments/upcoming` | `startAt`, `registrationDeadline` | `startAt` asc |

> **Note**: `registrationDeadline` sort option on `/tournaments/upcoming` uses `createdAt` as a proxy when sorting since no dedicated registration deadline column exists.

## Relationships

```
Tournament
├── belongs to → Quiz (quizId)
├── has many → Participants (TournamentParticipant)
└── has many → Rounds (TournamentRound)
```

## Lifecycle

### Tournament

```
Upcoming (status = upcoming) — tournament created, not yet open for registration
    ↓ advanceTournamentToRegistration() — BullMQ scheduler
Registration (status = registration) — participants may register
    ↓ startDueTournaments() — BullMQ scheduler
Ongoing (status = ongoing) — participants may play
    ↓ finalizeDueTournaments() — BullMQ scheduler
Finished (status = finished) — results final
```

### TournamentParticipant

```
Active (status = active) — registered and participating
    ↓ withdraw()
Withdrawn (status = withdrawn) — withdrew from tournament
    ↓ re-register()
Active (reactivated)
    ↓ (result recorded by Instance module)
Completed (status = completed) — tournament finished with final rank
```

## Permissions

| Action | Permission |
|---|---|
| Create tournament | `TOURNAMENT_CREATE` |
| Register | `TOURNAMENT_REGISTER` |
| Submit attempt inside tournament | `TOURNAMENT_ATTEMPT` |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Tournament is anchored to a specific quiz. |
| **Social** | Publishes events via `SHARED_TOURNAMENT_EVENT_BUS` consumed by Social module for feed updates. |
| **Instance** | Publishes events via `SHARED_TOURNAMENT_EVENT_BUS` consumed by Instance module for multiplayer session coordination. |
| **Notification** | Publishes events via `SHARED_TOURNAMENT_EVENT_BUS` consumed by Notification module for participant notifications. |
| **Ranking** | Publishes events via `SHARED_TOURNAMENT_EVENT_BUS` consumed by Ranking module for XP/rank awards. |

## Invariants

- A tournament always has exactly one quiz.
- `endAt > startAt`.
- Registration is only accepted during `registration` status.
- Participant capacity cannot exceed `maxParticipants`.

## Future Extension Points

- **Bracket formats**: single-elimination, double-elimination, round-robin — not yet modeled.
- **Team tournaments**: not yet modeled (participants are individual users today).