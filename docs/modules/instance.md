# Instance Module

## Purpose

Owns the **real-time multiplayer quiz session lifecycle**: quiz rooms with host control, player join/exit, live leaderboard updates, and WebSocket-based real-time event push. Coordinates with the Attempt module to attach individual attempt results to instance players.

## Responsibilities

**Owns**
- Quiz instance (room) lifecycle: create, start, close
- Player join/exit
- Live leaderboard state
- Real-time push via WebSocket gateway

**Does not own**
- Quiz versions (Quiz module)
- Individual attempt scoring (Attempt module)

## Core Concepts

| Concept | Description |
|---|---|
| **QuizInstance** | A real-time room: `quizVersionId`, `hostUserId`, `status ∈ {open, started, closed}`, `maxPlayers`, `startedAt`. |
| **InstancePlayer** | A participant: `userId`, `status ∈ {joined, ready, playing, disconnected, finished}`, `score`, `rank`. |

## Business Rules

- **Host controls lifecycle**: only the host may start or close an instance.
- **Instance must be open**: players may only join when `status = open`.
- **Capacity cap**: join fails when `maxPlayers` is reached.
- **Attempt linking**: an attempt started inside a tournament round is linked to the instance player via `PlayerAttemptStartedEvent`.

## Relationships

```
QuizInstance
├── belongs to → QuizVersion (via quiz module)
├── belongs to → Host User
└── has many → Players (InstancePlayer)

InstancePlayer
├── belongs to → Instance
└── belongs to → User
```

## Lifecycle

### QuizInstance

```
Open (status = open)
    ↓ startInstance() [host only]
Started (status = started)
    ↓ closeInstance() [host only]
Closed (status = closed)
```

### InstancePlayer

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

## Permissions

No RBAC `@Permissions` guards. All REST endpoints require a valid JWT; WebSocket connections are authenticated via handshake token.

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Attempt** | Subscribes to `AttemptStartedEvent` and `AttemptCompletedEvent` from `ATTEMPT_DOMAIN_EVENT_BUS`; links attempt results to instance players. |
| **Tournament** | Subscribes to `tournament.joined`, `tournament.participant.withdrawn`, `tournament.completed`, `tournament.won` via `SHARED_TOURNAMENT_EVENT_BUS`. |

## Invariants

- An instance always has exactly one host.
- Only the host may change instance status.
- Player joins are only accepted when instance is `open`.

## Future Extension Points

- **Spectator mode**: not yet modeled.
- **Round-based instances**: not yet modeled (single round per instance today).