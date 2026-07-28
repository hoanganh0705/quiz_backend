# Attempt Module

## Purpose

Owns the **quiz-taking session lifecycle**: starting an attempt on a quiz version, submitting and withdrawing answers, abandoning an attempt, and completing it with scoring. Emits `AttemptCompletedEvent` which is the primary trigger for XP awards (via Ranking), quiz stats refresh (via Quiz), and achievement evaluation (via Achievement).

## Responsibilities

**Owns**
- Attempt lifecycle: start, submit answer, withdraw answer, abandon, complete
- Answer recording and score calculation
- XP rewards (calculated on attempt completion)
- Milestone tracking (quiz completion count thresholds)
- Attempt-scoped analytics

**Does not own**
- Quiz version content (read-only via forwardRef to Quiz)
- XP ranking records (Ranking module)
- Badge awards (Achievement module)
- Quiz stats (Quiz module)

## Core Concepts

| Concept | Description |
|---|---|
| **QuizAttempt** | A user's session on a quiz version: `status ∈ {started, completed, abandoned}`, `score`, `startedAt`, `completedAt`. |
| **QuizAttemptAnswer** | A single answer recorded for a question: `questionId`, `selectedOptionId`, `isCorrect`, `answeredAt`. |
| **QuizAttemptEvent** | Immutable audit log of attempt state transitions. |

## Business Rules

- **One active attempt per user per quiz version**: starting a second attempt on the same version raises `ATTEMPT_ALREADY_STARTED`.
- **Quiz must be published**: attempts can only start on `published` quiz versions.
- **Submit only on active attempts**: `status = started` only.
- **Withdraw only on active attempts**: `status = started` only.
- **Complete only on active attempts**: `status = started` only.
- **Abandon only on active attempts**: `status = started` only.
- **Answers validated against version**: submitted `questionId` and `selectedOptionId` must belong to the attempt's quiz version.
- **Duplicate answer submission**: idempotent — a re-submit of the same question replaces the prior answer.
- **XP awarded on completion**: calculated from `quizVersion.rewardXp` × score percentage.
- **Milestone events**: `quiz.milestone` fires when completed attempt count reaches 10, 50, 100, 200, 500, 1000.

## Relationships

```
QuizAttempt
├── belongs to → User (actorId)
├── belongs to → QuizVersion (via quizId — Quiz module owns the FK)
├── has many → Answers (QuizAttemptAnswer)
├── has many → Events (QuizAttemptEvent)
└── completion triggers → Ranking (XP award), Quiz (stats refresh), Achievement (milestone evaluation)
```

## Lifecycle

### QuizAttempt

```
Started (status = started)
    ↓ completeAttemptAndSideEffects()
Completed (status = completed; score calculated; XP awarded)
    ↓ (terminal)

Started
    ↓ abandon()
Abandoned (status = abandoned; no score, no XP)
    ↓ (terminal)
```

## Permissions

No RBAC `@Permissions` guards are used. All attempt endpoints require a valid JWT; data is scoped to the authenticated user.

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Listens to `attempt.completed` via `ATTEMPT_DOMAIN_EVENT_BUS`; calls `refreshQuizMetrics(event.quizId)` to update `quizStats`. Also reads quiz version data via forwardRef for attempt start validation. |
| **Ranking** | Emits `AttemptCompletedEvent` which is consumed by `RankingService` for XP ingestion and rank recalculation. |
| **Achievement** | Emits `quiz.milestone` event consumed by `AchievementModule` for milestone badge evaluation. |
| **Instance** | Publishes `AttemptStartedEvent` and `AttemptCompletedEvent` via the shared event bus for multiplayer instance tracking. |

## Invariants

- An active attempt is unique per `(userId, quizVersionId)` pair.
- Answers always belong to the attempt's quiz version.
- An attempt transitions to `completed` or `abandoned` exactly once.
- XP is awarded exactly once per completed attempt.

## Future Extension Points

- **Time-limited attempts**: the version has `durationMs` but time-bound enforcement is not yet implemented.
- **Partial scoring**: not yet modeled (all-or-nothing on attempt completion today).
- **Attempt review**: completed attempts can be reviewed for correct answers; the current implementation does not surface the correct-answer key to the user after completion.

## Conventions

### Event Naming

Events follow the pattern `<domain>.<action>` using dot notation. The attempt module emits:

| Event | Description |
|-------|-------------|
| `attempt.started` | User begins a quiz attempt |
| `attempt.completed` | User finishes a quiz (triggers XP, stats, achievements) |
| `attempt.abandoned` | User abandons a quiz attempt |
| `quiz.milestone` | User reaches a quiz completion milestone (10, 50, 100, 250, 500, 1000) |

See [ADR-0014 Event Architecture](./adr/0014-event-architecture.md) for the three-layer event bus design.

### Verb Conventions for DELETE Operations

| Resource | Verb | Rationale |
|----------|------|-----------|
| Answer | `withdrawAnswer` | User can resubmit; not a hard delete |
| Tag | `unfollow` | Social relationship (see tag module) |
| Bookmark | `remove` | Clear action (see bookmark module) |

### Why Question Hydration is Duplicated

The attempt module duplicates question hydration logic from the quiz module. This is **intentional** to avoid circular dependencies — the attempt module uses `forwardRef` to access quiz module repositories, but the hydration logic requires data from both modules. By duplicating the hydrator locally, each module remains independently deployable.