# BACKEND ROADMAP V1

## Current Status

Completed Modules:

* Auth
* User
* Quiz
* Attempt
* Review
* Bookmark
* Category
* Tag
* Tournament
* Instance

Recently Added:

* User Ranking Schema

Goal:

Complete missing core backend domains before expanding into advanced features.

---

# PHASE 1 — RANKING DOMAIN

## Objective

Create a complete ranking subsystem.

## Deliverables

Ranking Module

Leaderboard Queries

User Rank Queries

Ranking Refresh Process

Ranking Statistics

## Flows

Quiz Attempt
↓
XP Updated
↓
Ranking Data Refreshed
↓
Leaderboard Available

## Endpoints

Leaderboard

User Rank

Period-based Rankings

---

# PHASE 2 — USER PROFILE DOMAIN

## Objective

Expose public user information.

## Deliverables

Public Profile

User Statistics

User Activity

User Ranking Integration

Badge Integration

## Flows

User
↓
Profile
↓
Stats
↓
Activity
↓
Ranking

---

# PHASE 3 — ACHIEVEMENT DOMAIN

## Objective

Turn badges into a real system.

## Deliverables

Achievement Engine

Badge Assignment

XP Milestones

Streak Milestones

Tournament Milestones

Achievement History

## Flows

User Action
↓
Rule Evaluation
↓
Achievement Awarded
↓
Badge Stored

---

# PHASE 4 — QUIZ ANALYTICS DOMAIN

## Objective

Provide creator-facing analytics.

## Deliverables

Quiz Performance Metrics

Attempt Statistics

Completion Rates

Review Metrics

Popularity Metrics

Trending Metrics

## Flows

Attempts
↓
Aggregation
↓
Analytics
↓
Insights

---

# PHASE 5 — NOTIFICATION DOMAIN

## Objective

Centralized notification system.

## Deliverables

Notification Entity

Read Status

Notification Delivery

Notification Preferences

Notification History

## Flows

System Event
↓
Notification Created
↓
Notification Stored
↓
User Reads

---

# PHASE 6 — SOCIAL DOMAIN

## Objective

User-to-user interactions.

## Deliverables

User Search

Friend Requests

Friend Relationships

Block Lists

Friend Rankings

## Flows

Find User
↓
Request
↓
Accept
↓
Relationship Created

---

# PHASE 7 — DISCUSSION DOMAIN

## Objective

Community interactions.

## Deliverables

Discussion Threads

Comments

Replies

Voting

Moderation

## Flows

Discussion
↓
Comments
↓
Replies
↓
Voting

---

# TECHNICAL DEBT

## DTO Enrichment

Quiz DTO

* Category
* Tags
* Creator
* Statistics

Tournament DTO

* Participant Count
* Registration Status

User DTO

* Rank
* Achievements
* Statistics

---

# OUT OF SCOPE

Do Not Build Yet

* GraphQL
* Realtime Rankings
* Realtime Notifications
* Chat
* Guilds
* Seasons
* AI Features

Reason:

Core domains are still incomplete.
