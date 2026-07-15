# Tournament Module

## Purpose

Owns the **competitive quiz event lifecycle**: tournament creation, registration phases, round management, live leaderboards, and scheduled lifecycle transitions (BullMQ-based).

## Responsibilities

**Owns**
- Tournament catalog and lifecycle management (registration → ongoing → completed)
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
| **Tournament** | An event: `title`, `description`, `quizId`, `startAt`, `endAt`, `registrationDeadline`, `status ∈ {registration, ongoing, completed}`, `maxParticipants`. |
| **TournamentParticipant** | A user's registration: `status ∈ {registered, withdrawn, playing, finished}`, `registeredAt`, `finalRank`. |
| **TournamentRound** | A round within a tournament with `status ∈ {pending, open, closed}`. |

## Business Rules

- **End after start**: `endAt` must be after `startAt`.
- **Registration window**: registration only accepted when `status = registration`.
- **Withdraw window**: withdrawal only allowed when `status = ongoing`.
- **Unregister window**: unregistration only allowed when `status = registration`.
- **Capacity cap**: registration fails when `maxParticipants` is reached.
- **Re-registration**: withdrawing then re-registering reactivates the participant record.
- **Leaderboard**: computed from participant results.

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
Registration (status = registration)
    ↓ startTournament()
Ongoing (status = ongoing) — participants may play
    ↓ completeTournament()
Completed (status = completed) — results final
```

### TournamentParticipant

```
Registered (status = registered)
    ↓ withdraw()
Withdrawn (status = withdrawn)
    ↓ re-register()
Registered (reactivated)
    ↓ (within ongoing tournament)
Playing (status = playing)
    ↓ (result recorded)
Finished (status = finished)
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