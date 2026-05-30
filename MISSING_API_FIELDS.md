# Missing API Fields & Features

> **Generated**: 2026-05-30
> **Updated**: 2026-05-30 - Mock data removal & SDK migration
> **Status**: Backend API does not cover all frontend requirements

---

## Overview

The backend OpenAPI spec covers core quiz functionality, but several features require additional endpoints or data that is not yet available.

---

## Migration Status

### Completed - Using Generated SDK via Wrappers

| Feature | File | Status |
|---------|------|--------|
| **Auth** | `auth/wrappers/auth.wrapper.ts` | ✅ Using `authOnlyInstance` |
| **Users** | `users/wrappers/user.wrapper.ts` | ✅ Using generated SDK |
| **Quizzes** | `quizzes/api/quizzes.wrapper.ts` | ✅ Using generated SDK |
| **Tournaments** | `tournaments/wrappers/tournament.wrapper.ts` | ✅ Using generated SDK |
| **Tournaments API** | `tournaments/api/tournaments.ts` | ✅ Now uses wrapper (migrated) |
| **Bookmarks** | `bookmarks/wrappers/bookmark.wrapper.ts` | ✅ Using generated SDK |
| **Reviews** | `reviews/wrappers/review.wrapper.ts` | ✅ Using generated SDK |
| **Tags** | `tags/wrappers/tag.wrapper.ts` | ✅ Using generated SDK |
| **Tags Admin** | `tags/api/tags-admin.ts` | ✅ Created (using wrapper) |
| **Categories** | `categories/wrappers/category.wrapper.ts` | ✅ Using generated SDK |
| **Categories Admin** | `categories/api/categories-admin.ts` | ✅ Created (using wrapper) |
| **Instances** | `instances/wrappers/instance.wrapper.ts` | ✅ Using generated SDK |
| **Attempts** | `attempts/wrappers/attempt.wrapper.ts` | ✅ Using generated SDK |

### Backend SDK Not Available - Need Backend Implementation

| Feature | File | Status | Backend Endpoint Needed |
|---------|------|--------|------------------------|
| **Notifications** | `notifications/api/notifications.ts` | ⚠️ Uses old `apiClient` | `GET /api/v1/notifications` |
| **Discussions** | `discussions/api/discussions.ts` | ⚠️ Uses old `apiClient` | `GET /api/v1/discussions` |
| **Support** | `support/api/support.ts` | ⚠️ Uses old `apiClient` | `GET /api/v1/support` |

---

## Mock Data Removal Summary

### Deleted Mock Data Files

| File | Reason |
|------|--------|
| `leaderboard/constants/players.ts` | 11 hardcoded player profiles |
| `leaderboard/constants/liveWinner.ts` | 6 hardcoded winner entries |
| `leaderboard/constants/leaderboard.ts` | Hardcoded leaderboard data |
| `daily-challenge/constants/challenge-history-data.ts` | 5 hardcoded challenge entries |
| `daily-challenge/constants/streak-rewards.ts` | 4 hardcoded streak rewards |
| `daily-challenge/constants/performance-data.ts` | 7 hardcoded performance entries |
| `marketing/constants/testimonialData.ts` | 3 hardcoded testimonials |

### Components Updated to Remove Mock Data

| Component | Change |
|-----------|--------|
| `GlobalLeaderboard.tsx` | Now fetches from tournament API, shows loading/error/empty states |
| `LiveWinner.tsx` | Props-based, shows empty state when no winners |
| `PlayerRanking.tsx` | Now fetches from tournament API |
| `PlayerCard.tsx` | Updated interface, uses optional props |
| `my-profile/page.tsx` | Removed hardcoded badges, streakRewards, challengeData imports |
| `use-my-profile-page.ts` | Returns empty arrays for activities until API available |

---

## 1. Missing Backend Endpoints

### 1.1 Global Leaderboard

| Feature | Backend API | Frontend Need |
|---------|-----------|---------------|
| **Global Leaderboard** | ❌ Not available | Show top players across all quizzes |
| **Weekly/Monthly/All-time filters** | ❌ Not available | Filter by time period |
| **Category leaderboard** | ❌ Not available | Leaderboard per category |
| **User rank lookup** | ❌ Not available | "You are ranked #X" |

**Current Workaround**: Using tournament leaderboards as fallback.

---

### 1.2 Friends & Social

| Feature | Backend API | Frontend Need |
|---------|-----------|---------------|
| **Search users** | ❌ Not available | Find users by username/email |
| **Send friend request** | ❌ Not available | Add friends |
| **Accept/decline requests** | ❌ Not available | Manage requests |
| **List friends** | ❌ Not available | View friends list |
| **Block/unblock users** | ❌ Not available | Privacy controls |

**Current Workaround**: LocalStorage only (data not persisted).

---

### 1.3 User Profiles

| Feature | Backend API | Frontend Need |
|---------|-----------|---------------|
| **Public user profile** | ❌ Not available | View other users' profiles |
| **User stats (XP, streak)** | ⚠️ Partial | `UserMeResponseDto` has these |
| **Achievements** | ❌ Not available | Badge/achievement system |
| **Online status** | ❌ Not available | "User is online" indicators |
| **Activity history** | ❌ Not available | Recent quizzes, comments, etc. |

---

### 1.4 Discussions / Comments

| Feature | Backend API | Frontend Need |
|---------|-----------|---------------|
| **Create discussion** | ❌ Not available | Start a discussion thread |
| **List discussions** | ❌ Not available | Browse discussions |
| **Add comment** | ❌ Not available | Reply to discussions |
| **Upvote/downvote** | ❌ Not available | Rate discussions |

**Frontend**: Has placeholder UI for discussions feature.

---

### 1.5 Quiz Management

| Feature | Backend API | Frontend Need |
|---------|-----------|---------------|
| **List my quizzes** | ❌ Not available | Creator dashboard |
| **Quiz analytics** | ❌ Not available | Views, plays, completion rate |
| **Clone quiz** | ❌ Not available | Duplicate existing quiz |
| **Report quiz** | ❌ Not available | Community moderation |

---

### 1.6 Notifications

| Feature | Backend API | Frontend Need |
|---------|-----------|---------------|
| **List notifications** | ❌ Not available | Notification center |
| **Mark as read** | ❌ Not available | Dismiss notifications |
| **Delete notification** | ❌ Not available | Remove old notifications |
| **Push notifications** | ❌ Not available | Real-time alerts |

**Frontend**: Has UI but uses mock data.

---

## 2. Backend-Frontend Type Mismatches

### 2.1 Difficulty Enum Case

| Location | Backend | Frontend (Old) |
|----------|--------|----------------|
| DTO | `easy`, `medium`, `hard` (lowercase) | `Easy`, `Medium`, `Hard` (title case) |

**Status**: Fixed - Frontend now uses backend enum values.

---

### 2.2 ID Types

| Entity | Backend | Frontend (Old) |
|--------|--------|----------------|
| User ID | `string` (UUID) | `number` |
| Quiz ID | `string` (UUID) | `string` ✅ |
| Category ID | `string` (UUID) | `string` ✅ |

**Status**: Varied - Some old types may still use `number`.

---

### 2.3 Bookmark API Structure

| Issue | Details |
|-------|--------|
| **Backend path** | `/api/v1/bookmarks/collections/{collectionId}/quizzes/{quizId}` |
| **Frontend expected** | Simple `/api/v1/bookmarks` with nested data |

**Status**: Frontend updated to match backend structure.

---

## 3. Missing DTO Fields

### 3.1 UserMeResponseDto

```typescript
// Current fields
{
  userId: string
  email: string
  displayName: string
  bio?: string
  avatarUrl?: string
  xp: number
  streak: { current: number; longest: number; updatedAt: string }
  settings: { ... }
  createdAt: string
  verifiedAt?: string
}

// Missing fields needed by frontend:
- achievements: Achievement[]
- badges: Badge[]
- stats: { totalQuizzes, averageScore, winRate }
- rank: number
- isOnline: boolean
- lastActive: string
```

---

### 3.2 TournamentResponseDto

```typescript
// Current fields
{
  tournamentId: string
  title: string
  description?: string
  categoryId?: string
  maxParticipants?: number
  prize?: string
  difficulty?: string
  status: TournamentStatus
  startsAt: string
  endsAt: string
  createdAt: string
}

// Missing fields needed by frontend:
- participantCount: number
- rounds: TournamentRound[]
- isRegistered: boolean
- bannerImageUrl?: string
- registrationDeadline?: string
```

---

### 3.3 QuizResponseDto

```typescript
// Current fields
{
  quizId: string
  creatorId?: string
  title: string
  description?: string
  slug: string
  requirements?: string
  imageUrl?: string
  isFeatured: boolean
  isHidden: boolean
  isVerified: boolean
  publishedVersionId?: string
  createdAt: string
  updatedAt: string
  publishedVersion?: QuizVersionResponseDto
}

// Missing fields needed by frontend:
- tags: Tag[]
- category: Category
- creator: User (with full profile)
- questionCount: number
- averageRating: number
- totalAttempts: number
- playCount: number
```

---

## 4. Recommended Backend Additions

### Priority 1: Critical

1. **Global Leaderboard API**
   ```typescript
   GET /api/v1/leaderboard
   GET /api/v1/leaderboard/me (current user rank)
   GET /api/v1/leaderboard/categories/{categoryId}
   ```

2. **Notifications API**
   ```typescript
   GET /api/v1/notifications
   POST /api/v1/notifications/{id}/read
   DELETE /api/v1/notifications/{id}
   ```

### Priority 2: Important

3. **Friends/Social API**
   ```typescript
   GET /api/v1/users/search?q={query}
   POST /api/v1/friends/{userId}
   DELETE /api/v1/friends/{userId}
   GET /api/v1/friends
   ```

4. **User Profile Public API**
   ```typescript
   GET /api/v1/users/{userId}
   GET /api/v1/users/{userId}/stats
   ```

### Priority 3: Nice to Have

5. **Discussions API**
6. **Quiz Analytics API**
7. **Achievements API**
8. **Support/FAQ API** (for contact forms, FAQs)

---

## 5. Files with Known Issues

| File | Issue | Severity |
|------|-------|----------|
| `LeaderboardHighlights.tsx` | Uses tournament leaderboard as fallback for global leaderboard | Medium |
| `FriendsPage` | Uses localStorage only (no backend) | High |
| `QuizResults` | Cannot fetch results (no attempt ID storage) | Medium |
| `YourRankingPopup` | Uses mock user profile data | High |
| `notifications/api/notifications.ts` | Uses old apiClient (no backend SDK) | Medium |
| `discussions/api/discussions.ts` | Uses old apiClient (no backend SDK) | Medium |
| `support/api/support.ts` | Uses old apiClient (no backend SDK) | Medium |

---

## 6. GraphQL Recommendations

Some pages could benefit from GraphQL for more efficient data fetching:

### 6.1 My Profile Page (`my-profile/page.tsx`)
**Current Issue**: Needs multiple API calls (user data, quizzes, achievements, stats)
**Recommendation**: GraphQL to batch fetch all profile data in single query

### 6.2 Leaderboard Page (`leaderboard/page.tsx`)
**Current Issue**: Leaderboard, user rankings, and stats are fetched separately
**Recommendation**: GraphQL to fetch global rankings with user details

### 6.3 Admin Dashboard
**Current Issue**: Multiple tables need separate API calls
**Recommendation**: GraphQL for admin queries with filtering

### 6.4 Quiz Detail Page
**Current Issue**: Quiz info, reviews, creator info fetched separately
**Recommendation**: GraphQL for complex quiz data

---

## 7. Testing Checklist

- [ ] Homepage loads quizzes from API
- [ ] Quiz catalog filters work
- [ ] Quiz detail page shows real data
- [ ] Tournaments list from API
- [ ] Leaderboard shows tournament data
- [ ] Bookmarks work with backend
- [ ] Reviews load from API
- [ ] User profile displays correct data
- [ ] Notifications page works (when backend added)
- [ ] Discussions page works (when backend added)

---

*Document will be updated as backend API evolves.*
