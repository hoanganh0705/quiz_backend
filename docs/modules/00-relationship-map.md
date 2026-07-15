# Module Relationship Map

This document shows how every bounded context interacts with every other bounded context. It is the authoritative cross-module reference; individual module documents reference their neighbors here rather than duplicating the full relationship diagram.

---

## Legend

```
[A] — Auth module (identity, sessions, JWT)
[U] — User module (profiles, settings, rankings, badges, activity)
[Q] — Quiz module (quizzes, versions, questions, options, stats)
[Ta] — Tag module (tags, follows, ranking)
[Ca] — Category module (categories, follows)
[D] — Discussion module (threads, comments, votes, reports, moderation)
[At] — Attempt module (attempts, answers, scoring)
[B] — Bookmark module (collections, bookmarks)
[Rv] — Review module (reviews, votes, reports)
[To] — Tournament module (tournaments, participants, rounds)
[I] — Instance module (real-time rooms, players)
[Rk] — Ranking module (XP, ranks, leaderboards)
[Ah] — Achievement module (badges, rules, grants)

[→] — consumes / listens to
[←] — produces / emits to
[↔] — bidirectional
```

---

## Cross-Module Interaction Matrix

| Producer | Consumer | Interaction | Shared Bus / Port |
|---|---|---|---|
| [At] Attempt | [Rk] Ranking | `AttemptCompletedEvent` → XP ingestion | `ATTEMPT_DOMAIN_EVENT_BUS` (in-process) |
| [At] Attempt | [Q] Quiz | `AttemptCompletedEvent` → refresh `quizStats` | `ATTEMPT_DOMAIN_EVENT_BUS` |
| [At] Attempt | [Ah] Achievement | `quiz.milestone` → badge rule evaluation | `ATTEMPT_DOMAIN_EVENT_BUS` |
| [At] Attempt | [I] Instance | `AttemptStartedEvent`, `AttemptCompletedEvent` → player tracking | `SHARED_ATTEMPT_EVENT_BUS` (shared token) |
| [At] Attempt | [To] Tournament | Attempt inside tournament round → participant result | ForwardRef to [To] |
| [Q] Quiz | [Ta] Tag | Tag lists filtered by `quizStats`; Tag analytics via `QUIZ_ANALYTICS_PORT` | `QUIZ_LISTING_PORT`, `QUIZ_ANALYTICS_PORT` |
| [Q] Quiz | [Ca] Category | Category lists filtered by `quizStats`; Category analytics via `QUIZ_ANALYTICS_PORT` | `QUIZ_LISTING_PORT`, `QUIZ_ANALYTICS_PORT` |
| [Q] Quiz | [D] Discussion | `quiz.deleted` audit event; Discussion validates quiz existence | `QuizExistencePort` (inbound to [D]) |
| [Q] Quiz | [Rv] Review | `review.submitted/deleted` → refresh `quizStats.avgRating` | `REVIEW_DOMAIN_EVENT_BUS` |
| [D] Discussion | [U] User | Discussion validates user existence; `@username` mention resolution | `UserExistencePort` (inbound to [D]) |
| [D] Discussion | [U] Notification | `notification.sent` → user notified | `DiscussionNotificationListener` (inbound to Notification module) |
| [D] Discussion | [U] Social | Social feed records `comment_created`, `discussion_created`, `discussion_solved` | `DiscussionFeedListenerAdapter` (inbound to Social module) |
| [Ta] Tag | [Q] Quiz | Tag lists quizzes via `QUIZ_LISTING_PORT`; reads tag analytics via `QUIZ_ANALYTICS_PORT` | `QUIZ_LISTING_PORT`, `QUIZ_ANALYTICS_PORT` |
| [Ca] Category | [Q] Quiz | Category lists quizzes via `QUIZ_LISTING_PORT`; reads category analytics via `QUIZ_ANALYTICS_PORT` | `QUIZ_LISTING_PORT`, `QUIZ_ANALYTICS_PORT` |
| [Rv] Review | [Q] Quiz | Review validates attempt existence before review creation | Inbound to [Q] |
| [To] Tournament | [I] Instance | Tournament coordinates multiplayer; player events linked to attempts | `SHARED_TOURNAMENT_EVENT_BUS` |
| [To] Tournament | [Ah] Achievement | Tournament win → badge evaluation | `SHARED_TOURNAMENT_EVENT_BUS` |
| [To] Tournament | [Rk] Ranking | Tournament XP → rank recalculation | `SHARED_TOURNAMENT_EVENT_BUS` |
| [To] Tournament | [U] Notification | `tournament.starting_soon`, `tournament.completed`, `tournament.won` → notifications | `SHARED_TOURNAMENT_EVENT_BUS` |
| [To] Tournament | [U] Social | Social feed records tournament participation | `SHARED_TOURNAMENT_EVENT_BUS` |
| [Rk] Ranking | [Ah] Achievement | Rank-based badge grants (`RankAchievementService`) | `SHARED_RANKING_EVENT_BUS` |
| [Rk] Ranking | [U] User | Updates `UserRanking`; emits `user.streak_updated` | `USER_DOMAIN_EVENT_BUS` |
| [Rk] Ranking | [U] Notification | `rank.changed`, `peak.rank.achieved` → notifications | `RANKING_DOMAIN_EVENT_BUS` |
| [Ah] Achievement | [U] User | Persists `UserBadge` in `user_badges` table | Direct write (same DB) |
| [Ah] Achievement | [U] Notification | Badge award → notification | `SHARED_ACHIEVEMENT_EVENT_BUS` |
| [Ah] Achievement | [Rk] Ranking | XP reward from badge → rank update | `SHARED_ACHIEVEMENT_EVENT_BUS` |
| [I] Instance | [At] Attempt | Links attempt results to instance players via events | `ATTEMPT_DOMAIN_EVENT_BUS` |
| [I] Instance | [To] Tournament | Coordinates with tournament session lifecycle | `SHARED_TOURNAMENT_EVENT_BUS` |
| [B] Bookmark | [Q] Quiz | Bookmark counts feed `quizStats.bookmarkCount` | Direct read (same DB) |
| [A] Auth | [U] User | Auth constructs `JwtPayload`; reads `UserMeRow` from User module | `USER_DOMAIN_SERVICE` |
| [A] Auth | [U] Notification | Security events (`password_changed`, `session_revoked`, etc.) → notifications | `AuthSecurityNotificationService` |
| [A] Auth | [U] Email | Auth sends verification and password-reset emails | `EmailProvider` (Email module) |

---

## Interaction Diagram

```
                        ┌─────────────────────────────────────────────────────────────┐
                        │                        AUTH [A]                           │
                        │  Owns: identity, sessions, JWT, OAuth, password reset     │
                        └─────────────────────┬─────────────────────────────────────┘
                                              │ reads UserMeRow
                                              │ emits security events
                        ┌─────────────────────▼──────────────────────────────┐
                        │                     USER [U]                        │
                        │  Owns: profiles, settings, rankings, badges,       │
                        │         activity, tournament participation         │
                        └─────────────────────┬──────────────────────────────┘
                                              │ owns user_badges
                                              │ emits profile/streak events
                        ┌─────────────────────▼──────────────────────────────┐
                        │                 ATTEMPT [At]                      │
                        │  Owns: attempts, answers, scoring, milestones      │
                        └──────┬──────────────┬──────────────────┬───────────┘
                               │              │                  │
              emits XP event   │   emits milestone   emits attempt  emits attempt
                               │   to Ranking       events to      events to
                               │                    Instance        Quiz
                               ▼                  ▼                ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   RANKING [Rk]   │  │  ACHIEVEMENT [Ah]│  │   INSTANCE [I]   │  │     QUIZ [Q]     │
│  Owns: XP, ranks │  │ Owns: badges,   │  │ Owns: rooms,     │  │ Owns: quizzes,   │
│  leaderboards,    │◄─│ rules, grants    │  │ players, WS      │  │ versions,        │
│  period resets   │  │                  │  │                  │  │ questions, stats │
└───────┬──────────┘  └───────┬──────────┘  └───────┬──────────┘  └───────┬──────────┘
        │                    │                     │                   │
 emits  │  rank events       │  badge XP award      │  player events   │  refreshes
 rank   │  to Notification   │  to Ranking         │  to Tournament  │  quizStats
 change │                    │                     │                  │
 events │                    │                     │                  │
        │                    ▼                     │                  ▼
        │   ┌──────────────────────────────────┐ │      ┌──────────────────────────┐
        │   │        TOURNAMENT [To]           │◄┘      │    DISCUSSION [D]        │
        │   │ Owns: tournaments, participants, │        │ Owns: threads, comments, │
        │   │ rounds, BullMQ lifecycle         │        │ votes, reports, mod      │
        │   └──────────┬──────────────┬─────────┘        └──────────┬─────────────┘
        │             │              │                             │
    emits         emits         emits                             emits
    XP events     player        results                           thread/comment
    to Ranking    events        to Social                         events to
                   to Instance  & Notification                   Social &
                                                                  Notification
                   ┌───────────▼──────────────────────────────────────────────┐
                   │  Notification Module (fan-out delivery; NOT a bounded ctx) │
                   │  Listens to: Auth, Discussion, Ranking, Achievement,      │
                   │             Tournament, User events                        │
                   └───────────────────────────────────────────────────────────┘

                   ┌───────────────────────────────────────────────────────────┐
                   │  Social Module (cross-module integration hub; NOT a       │
                   │  bounded context)                                         │
                   │  Listens to: Discussion, Tournament, Ranking, Achievement │
                   └───────────────────────────────────────────────────────────┘
```

---

## Key Shared Event Buses

| Bus | Owner | Consumed by |
|---|---|---|
| `ATTEMPT_DOMAIN_EVENT_BUS` | Attempt | Quiz, Ranking, Achievement, Instance |
| `SHARED_TOURNAMENT_EVENT_BUS` | Tournament | Ranking, Achievement, Instance, Notification, Social |
| `SHARED_RANKING_EVENT_BUS` | Ranking | Achievement |
| `SHARED_ACHIEVEMENT_EVENT_BUS` | Achievement | Ranking, Notification |
| `REVIEW_DOMAIN_EVENT_BUS` | Review | Quiz |
| `RANKING_DOMAIN_EVENT_BUS` | Ranking | Notification |
| `USER_DOMAIN_EVENT_BUS` | User | — |
| `DISCUSSION_DOMAIN_EVENT_BUS` | Discussion | Notification, Social |

---

## Not Bounded Contexts

| Module | Role | Reason |
|---|---|---|
| **Notification** | Fan-out delivery layer | No domain aggregate; purely reactive to other modules' events |
| **Social** | Cross-module integration hub | Heavily imports 8 modules; aggregates feed data rather than owning a domain model |
| **Search** | Thin infrastructure orchestrator | No ports, no domain events; directly queries core schema tables |
| **Email** | Infrastructure service | Sends emails; no domain model |
| **Health** | Infrastructure endpoint | Health check only |

---

## Cross-module FK References (Database Level)

```
tags.tagId         ← tag_follows.tagId         (cascade)
tags.tagId         ← quizTags.tagId             (cascade)
users.userId       ← tag_follows.userId        (cascade)
users.userId       ← category_follows.userId    (cascade)
categories.catId   ← quizzes.categoryId         (set null)
users.userId       ← quizzes.creatorId          (set null)
quizzes.quizId     ← discussion_threads.quizId  (cascade)
quizzes.quizId     ← quizAttempts.quizId       (cascade)
quizzes.quizId     ← reviews.quizId            (cascade)
quizzes.quizId     ← bookmarked_quizzes.quizId (cascade)
quizzes.quizId     ← quiz_instances.quizId      (restrict)
users.userId       ← discussion_threads.authorId (cascade)
users.userId       ← quizAttempts.userId        (cascade)
users.userId       ← reviews.userId            (cascade)
```

---

## Module Ownership Summary

| Module | Owns (source of truth) | Consumes from |
|---|---|---|
| [A] Auth | Users, Sessions, Tokens, OAuth, Audit | User (read-only) |
| [U] User | Profiles, Settings, Rankings, Badges, Activity | Auth (identity), Ranking (rank events), Achievement (badge grants) |
| [Q] Quiz | Quizzes, Versions, Questions, Options, Stats | Tag (tag lists), Category (category lists), Review (rating refresh) |
| [Ta] Tag | Tags, Follows, Rankings | Quiz (quiz listings, analytics) |
| [Ca] Category | Categories, Follows, Rankings | Quiz (quiz listings, analytics) |
| [D] Discussion | Threads, Comments, Votes, Reports | Quiz (quiz existence), User (user existence) |
| [At] Attempt | Attempts, Answers, Scoring | Quiz (quiz version data), Ranking (XP), Achievement (milestones), Instance (attempt linking) |
| [B] Bookmark | Collections, Bookmarks | Quiz (quiz existence, analytics) |
| [Rv] Review | Reviews, Votes, Reports | Quiz (attempt validation), Quiz (rating refresh) |
| [To] Tournament | Tournaments, Participants, Rounds | Quiz (quizId), Ranking (XP), Achievement (badges), Instance (multiplayer), Notification, Social |
| [I] Instance | Rooms, Players | Quiz (quiz version), Attempt (attempt linking), Tournament (session coordination) |
| [Rk] Ranking | XP, Ranks, Leaderboards | Attempt (XP events), Tournament (XP), Achievement (badge XP), User (streaks), Notification (rank alerts) |
| [Ah] Achievement | Badges, Rules, History | Ranking (rank events), Attempt (milestones), Tournament (wins), User (badge persistence), Notification |