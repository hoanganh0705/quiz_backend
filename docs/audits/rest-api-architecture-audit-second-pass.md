# REST API Architecture Audit - Second Pass Self-Critique

**Date:** Monday Jul 20, 2026  
**Review Type:** Second-Pass Architectural Self-Critique  
**Purpose:** Challenge previous recommendations, correct over-aggressive consolidation, and produce a more architecturally sound final recommendation.

---

## Executive Summary

My first audit made a critical mistake: **I prioritized reducing endpoint count over architectural correctness**. I conflated three distinct concepts:

1. **Business Capabilities** (precomputed, computationally expensive, algorithm-driven) — These legitimately remain dedicated endpoints
2. **Resource Filtering** (simple boolean/status filters on stored data) — These may become query parameters
3. **Convenience Endpoints** (different paths to the same data) — These should be consolidated

This second-pass review reclassifies every recommendation and corrects the architectural errors.

---

## Critical Framework: Resource vs Capability Classification

Before reviewing recommendations, I must classify every endpoint type:

### Endpoint Type Definitions

| Type | Description | Examples |
|------|-------------|----------|
| **Resource** | Stored entities, filterable | Quizzes, Users, Categories, Comments |
| **Business Capability** | Precomputed, algorithm-driven, or derived | Trending, Popular, Recommendations, Leaderboard, Analytics |
| **Administrative Operation** | Platform management | Moderation, Reporting, System Status |
| **Convenience Endpoint** | Different path, same data | `/auth/me` vs `/users/me` |
| **Query Endpoint** | Complex search or aggregation | Search, Feed, Distribution |

**Key Principle:** Business Capabilities are NOT the same as Resource Filtering. A trending quiz is not "quizzes filtered by trending=TRUE" — it is the result of a ranking algorithm. Conflating these destroys architectural meaning.

---

## Issue-by-Issue Self-Critique

---

### Issue #1: Quiz Module Predefined Filters

**Previous Recommendation:** Consolidate `/quizzes/me`, `/quizzes/me/drafts`, `/quizzes/me/published`, `/quizzes/trending`, `/quizzes/popular`, `/quizzes/featured` into `GET /quizzes?...`

**RECOMMENDATION: MODIFY SUBSTANTIALLY**

#### Analysis:

| Endpoint | Type | Should Consolidate? | Reason |
|----------|-------|-------------------|--------|
| `/quizzes/me` | Resource | **Consider** | `creatorId=currentUser` is reasonable |
| `/quizzes/me/drafts` | Resource | **Keep** | Predefined filter for ownership + status |
| `/quizzes/me/published` | Resource | **Keep** | Predefined filter for ownership + status |
| `/quizzes/trending` | **Business Capability** | **REJECT** | Precomputed ranking algorithm result |
| `/quizzes/popular` | **Business Capability** | **REJECT** | Precomputed popularity algorithm result |
| `/quizzes/featured` | **Business Capability** | **REJECT** | Admin-curated selection, not a filter |

**Architectural Justification:**

Trending and Popular are NOT "quizzes filtered by trending=true" — they are the result of:
- Engagement velocity calculations
- Time-decay algorithms
- Cross-referencing attempt counts, ratings, completion rates

These are fundamentally different computations. Conflating them with query parameters loses the semantic distinction between "here are all quizzes" and "here is our algorithmic curation."

**Business Justification:**

Clients that display "Trending" in their UI expect a ranked list computed by business rules. If they use `GET /quizzes?sort=trending`, the semantic shift is:
- Before: "Give me the trending quizzes" (capability call)
- After: "Give me quizzes ordered by the trending metric" (query)

This is an acceptable semantic shift only if the implementation is the same. If trending uses a separate algorithm path, merging endpoints hides that complexity inappropriately.

**What to Keep:**

| Keep | Modify | Reason |
|------|--------|--------|
| `/quizzes/me` | Add `creatorId=me` to list endpoint | Simplifies auth-aware listing |
| `/quizzes/me/drafts` | **DEPRECATE** | Predefined filter — `GET /quizzes?creatorId=me&status=draft` |
| `/quizzes/me/published` | **DEPRECATE** | Predefined filter — `GET /quizzes?creatorId=me&status=published` |
| `/quizzes/trending` | **Keep as-is** | Business Capability — precomputed ranking |
| `/quizzes/popular` | **Keep as-is** | Business Capability — precomputed popularity |
| `/quizzes/featured` | **Keep as-is** | Business Capability — editorial curation |

**Migration Risk:**
- Low: Adding `creatorId` parameter is additive
- Medium: Deprecating `/quizzes/me/drafts` and `/quizzes/me/published`

**Final Recommendation:**

1. **ADD** `creatorId` parameter to `GET /quizzes` (safe)
2. **DEPRECATE** `/quizzes/me/drafts` → `GET /quizzes?creatorId=me&status=draft`
3. **DEPRECATE** `/quizzes/me/published` → `GET /quizzes?creatorId=me&status=published`
4. **KEEP** trending/popular/featured as Business Capabilities (do NOT deprecate)

---

### Issue #2: Category/Tag Sort Endpoints

**Previous Recommendation:** Consolidate `/categories/popular`, `/categories/trending`, `/tags/popular`, `/tags/trending` into query parameters.

**RECOMMENDATION: MODIFY SUBSTANTIALLY**

#### Analysis:

| Endpoint | Type | Should Consolidate? |
|----------|-------|-------------------|
| `/categories/popular` | **Business Capability** | **REJECT** |
| `/categories/trending` | **Business Capability** | **REJECT** |
| `/tags/popular` | **Business Capability** | **REJECT** |
| `/tags/trending` | **Business Capability** | **REJECT** |

**Architectural Justification:**

The same reasoning as Issue #1 applies. "Popular" and "Trending" categories/tags are not "categories sorted by follower count" — they involve:
- Follower velocity
- Recent activity signals
- Time-decay weighting

These are distinct algorithms. If the implementation shares code with simple sorting, that is an internal concern, not an API contract concern.

**However:** The first-pass audit correctly identified that the *list* endpoint should support sorting by simple fields (alphabetical, creation date).

**What to Keep:**

| Keep | Modify | Reason |
|------|--------|--------|
| `/categories/popular` | **Keep as-is** | Business Capability |
| `/categories/trending` | **Keep as-is** | Business Capability |
| `/tags/popular` | **Keep as-is** | Business Capability |
| `/tags/trending` | **Keep as-is** | Business Capability |
| `GET /categories` | **ADD** `?sort=name,createdAt` | Simple field sorting |
| `GET /tags` | **ADD** `?sort=name,createdAt` | Simple field sorting |

**Final Recommendation:**

1. **KEEP** all popular/trending dedicated endpoints
2. **ADD** simple sorting parameters (`sort=name`, `sort=createdAt`) to list endpoints

---

### Issue #3: Tournament Status Endpoints

**Previous Recommendation:** Keep dedicated status endpoints `/tournaments/upcoming`, `/tournaments/active`, `/tournaments/completed`.

**RECOMMENDATION: MODIFY — DEPRECATE STATUS ENDPOINTS**

#### Analysis

| Endpoint | Type | Should Consolidate? |
|----------|-------|-------------------|
| `/tournaments/upcoming` | **Predefined Filter** | **YES — Deprecate** |
| `/tournaments/active` | **Predefined Filter** | **YES — Deprecate** |
| `/tournaments/completed` | **Predefined Filter** | **YES — Deprecate** |

#### Why Not Keep Dedicated Endpoints?

**If they are identical to `GET /tournaments?status=X`:**
- Same SQL query
- Same response DTO
- Same caching strategy
- Same authorization

Then keeping both is **pure API surface redundancy with no architectural justification**.

**My previous justification ("high-traffic UX paths") was wrong because:**
1. API contracts should model the domain, not client UI patterns
2. Different clients have different needs — web, mobile, admin tools
3. Query parameters are equally discoverable: `/tournaments?status=upcoming`
4. Clients can create local aliases or SDK wrappers

#### Criteria: Predefined Filter vs. Business Capability

| Criterion | Predefined Filter | Business Capability |
|-----------|------------------|---------------------|
| **Computation** | None — WHERE clause | Algorithm, aggregation |
| **Result Determinism** | Same input → same output | May vary |
| **Ranking** | Explicit sort param | Proprietary algorithm |
| **Caching Strategy** | Same as base resource | May require separate cache |

**For tournament status:**
- `WHERE status = 'upcoming' AND startAt > NOW()` is a pure WHERE clause
- No algorithm, no computation
- Deterministic result
- Same cache as base resource

#### Final Recommendation

1. **DEPRECATE** dedicated status endpoints:
   ```
   GET /tournaments/upcoming   → GET /tournaments?status=upcoming
   GET /tournaments/active    → GET /tournaments?status=active
   GET /tournaments/completed → GET /tournaments?status=completed
   ```
2. **ADD** query parameters to base `GET /tournaments`:
   ```
   ?status={upcoming|active|completed|registration|cancelled}
   ?categoryId={uuid}
   ?tagIds={uuid1,uuid2}     # AND semantics — tournament must have ALL tags
   ?creatorId={uuid}
   ?sort={startAt|name}
   ```
3. **ADD** deprecation headers to old endpoints (Sunset, Deprecation, Link)
4. **KEEP** for 6 months before removal

---

### Issue #4: Discussion Predefined Filters

**Previous Recommendation:** Consolidate `/discussions/trending`, `/discussions/unanswered`, `/discussions/search`, unify `/discussions/threads` with `/quizzes/:quizId/discussions`.

**RECOMMENDATION: REJECT MOST OF THIS**

#### Analysis:

| Endpoint | Type | Should Consolidate? |
|----------|-------|-------------------|
| `/discussions/trending` | **Business Capability** | **REJECT** |
| `/discussions/unanswered` | **Query Endpoint** | **Consider** |
| `/discussions/search` | **Business Capability** | **REJECT** |
| `/quizzes/:quizId/discussions` | **Resource** | **Consider** |

**Architectural Justification:**

1. **Trending discussions** is a precomputed ranking algorithm — keep as-is.

2. **Search discussions** involves full-text search, potentially with ranking. This is fundamentally different from "list threads with `title CONTAINS X`" — it involves relevance scoring. **Keep as-is.**

3. **Unanswered discussions** (`hasComments = 0`) is the one case where simple filtering applies. However, as a dedicated UX path ("Help answer questions!"), keeping it separate is reasonable.

4. **Quiz discussions** (`GET /quizzes/:quizId/discussions`) vs general discussions (`GET /discussions/threads`) is a **resource ownership question**. Quiz discussions belong under `/quizzes` because:
   - They are scoped to a quiz
   - The Quiz bounded context owns this relationship
   - This is not duplicate data — quiz discussions are a different query scope

**What to Keep:**

| Keep | Modify | Reason |
|------|--------|--------|
| `/discussions/trending` | **Keep as-is** | Business Capability |
| `/discussions/search` | **Keep as-is** | Business Capability (search) |
| `/discussions/unanswered` | **Keep as-is** | UX path for community engagement |
| `/quizzes/:quizId/discussions` | **Keep as-is** | Resource scoped to quiz (not duplicate) |
| `GET /discussions/threads` | **ADD** `?quizId`, `?authorId`, `?hasComments`, `?status` | Enhance for advanced filtering |

**Final Recommendation:**

1. **KEEP** all dedicated discussion capability endpoints
2. **ADD** query parameters to `GET /discussions/threads` for filtering
3. **KEEP** quiz-scoped discussions as a separate resource path (correct bounded context ownership)

---

### Issue #5: Ranking Pagination Inconsistency

**Previous Recommendation:** Convert `/leaderboard` from offset to cursor pagination.

**RECOMMENDATION: REJECT**

#### Analysis:

| Current Design | Recommended | Verdict |
|---------------|-------------|---------|
| Offset-based | Cursor-based | **REJECT** |

**Architectural Justification:**

Leaderboard use cases are fundamentally different from standard list endpoints:

1. **"Show me ranks 100-200"** — This is a legitimate use case for offset pagination. A user wants to see where they rank relative to others in the 100-200 range.

2. **"Show me the top 100"** — Offset=0, limit=100. Works perfectly with offset pagination.

3. **Leaderboards are intentionally ordered by a single metric** (XP, score) — Unlike social feeds where chronological ordering matters, leaderboard stability within a snapshot is expected.

Cursor pagination is appropriate for:
- Feeds with dynamic insertion (new items can appear between pages)
- Chronological lists where "page 2" meaning changes as data is added
- Ordered-by-multiple-fields where offset produces inconsistent results

Cursor pagination is inappropriate for:
- Leaderboards (stable ordering, user expects page 2 to mean ranks 101-200)
- Ranked lists (you cannot "resume" from rank 150 — offset is the natural positioning mechanism)

**Business Justification:**

Changing the leaderboard to cursor pagination would:
- Break client implementations expecting offset-based navigation
- Lose the natural "show me rank N-M" semantic
- Provide no meaningful benefit (leaderboards are precomputed snapshots)

**Migration Risk:** High (breaking change for all leaderboard clients)

**Final Recommendation:**

1. **KEEP** offset pagination for leaderboard endpoints
2. **REJECT** cursor pagination conversion for leaderboards

---

### Issue #6: Achievement Offset Pagination

**Previous Recommendation:** Convert achievement endpoints from offset to cursor pagination.

**RECOMMENDATION: REJECT**

#### Analysis:

| Current Design | Recommended | Verdict |
|---------------|-------------|---------|
| Offset-based | Cursor-based | **REJECT** |

**Architectural Justification:**

Achievement/badge listings are:
- Small collections (users earn a finite number of badges)
- Ordered by a single field (typically `earnedAt` descending)
- Not subject to dynamic insertion during pagination

Offset pagination is appropriate here. Cursor pagination adds complexity without benefit.

**Final Recommendation:**

1. **KEEP** offset pagination for achievement endpoints
2. **REJECT** pagination style change

---

### Issue #7: Duplicate Review Endpoints

**Previous Recommendation:** Consolidate `GET /quizzes/:quizId/reviews/me` and `GET /users/me/reviews/:quizId`.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Endpoint | Type | Verdict |
|----------|-------|---------|
| `/quizzes/:quizId/reviews/me` | Duplicate Resource | **REMOVE** |
| `/users/me/reviews/:quizId` | Resource | **KEEP** |

**Architectural Justification:**

These are genuinely the same resource returned via two paths. There is no architectural justification for maintaining both.

The correct ownership is under `/users` because:
- A review belongs to a user
- The user context (`/me`) is the natural identity anchor
- Quiz-scoped access (`/quizzes/:id/reviews`) makes sense for listing reviews OF a quiz

**Final Recommendation:**

1. **KEEP** `GET /users/me/reviews/:quizId`
2. **DEPRECATE** `GET /quizzes/:quizId/reviews/me` (mark as deprecated, redirect)

---

### Issue #8: Duplicate User Discussion Endpoints

**Previous Recommendation:** Consolidate `GET /discussions/me` and `GET /users/me/discussions`.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Endpoint | Type | Verdict |
|----------|-------|---------|
| `/discussions/me` | Duplicate | **REMOVE** |
| `/users/me/discussions` | Resource | **KEEP** |

**Architectural Justification:**

These return the same data. The Discussion module incorrectly exposes `/discussions/me` when the canonical path is under User.

**Final Recommendation:**

1. **KEEP** `GET /users/me/discussions`
2. **DEPRECATE** `GET /discussions/me`

---

### Issue #9: Duplicate User Activity Endpoints

**Previous Recommendation:** Consolidate `GET /discussions/users/:userId/discussion-profile` and `GET /users/:userId/discussion-profile`.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Endpoint | Type | Verdict |
|----------|-------|---------|
| `/discussions/users/:userId/discussion-profile` | Duplicate | **REMOVE** |
| `/users/:userId/discussion-profile` | Resource | **KEEP** |

**Final Recommendation:**

1. **KEEP** `GET /users/:userId/discussion-profile`
2. **DEPRECATE** the discussions-scoped path

---

### Issue #10: Duplicate Auth/User Endpoints

**Previous Recommendation:** Consolidate `GET /auth/me` and `GET /users/me`.

**RECOMMENDATION: REJECT THIS RECOMMENDATION**

#### Analysis:

| Endpoint | Type | Verdict |
|----------|-------|---------|
| `/auth/me` | **Bounded Context** | **KEEP** |
| `/users/me` | **Resource** | **KEEP** |

**Architectural Justification:**

These represent **different bounded contexts**:

1. `/auth/me` — Returns authentication context:
   - Session information
   - Token validity
   - Security-related data
   - Permission context

2. `/users/me` — Returns user resource:
   - Profile information
   - Display settings
   - Activity data

They have different:
- **Security models** (auth vs. resource access)
- **Refresh semantics** (token validity vs. profile data)
- **Ownership** (Auth module vs. User module)
- **Caching strategies** (auth: short TTL; user: longer TTL)

Conflating these would:
- Violate bounded context boundaries
- Create circular dependencies
- Mix authentication concerns with resource concerns

**Final Recommendation:**

1. **KEEP BOTH** `/auth/me` and `/users/me`
2. **REJECT** the consolidation recommendation
3. Document the distinction in API documentation

---

### Issue #11: Duplicate Social Relationship Endpoints

**Previous Recommendation:** Consolidate social endpoints using a `type` query parameter.

**RECOMMENDATION: MODIFY — PARTIAL REJECT**

#### Analysis:

| Endpoint Pair | Type | Verdict |
|---------------|------|---------|
| `/social/followers` vs `/social/users/:userId/followers` | **Both Resource** | **MERGE** |
| `/social/following` vs `/social/users/:userId/following` | **Both Resource** | **MERGE** |
| `/social/friends` vs `/social/users/:userId/friends` | **Both Resource** | **MERGE** |

**Architectural Justification:**

These are genuinely duplicates. The `/social` prefix is redundant when the user is already specified.

**However:** The proposed consolidation into a single endpoint with `type` parameter is incorrect. A single endpoint with multiple modes (`/users/:userId/social?type=followers`) is:
- Harder to cache
- Complex to document
- Blurs the resource distinction

The correct approach is to standardize on one canonical path:

| Keep | Remove | Reason |
|------|--------|--------|
| `/users/:userId/followers` | `/social/followers` | Standardized under User |
| `/users/:userId/following` | `/social/following` | Standardized under User |
| `/users/:userId/friends` | `/social/friends` | Standardized under User |

**Final Recommendation:**

1. **KEEP** `/users/:userId/followers`, `/users/:userId/following`, `/users/:userId/friends`
2. **DEPRECATE** the `/social/...` variants
3. **DO NOT** create a single endpoint with multiple modes

---

### Issue #12: Duplicate Badge Endpoints

**Previous Recommendation:** Consolidate `GET /achievements/me/badges` and `GET /users/me/badges`.

**RECOMMENDATION: MODIFY — PARTIAL REJECT**

#### Analysis:

| Endpoint | Type | Verdict |
|----------|-------|---------|
| `/achievements/me/badges` | **Bounded Context** | **KEEP** |
| `/users/me/badges` | **Resource** | **KEEP** |

**Architectural Justification:**

Achievement and User are **different bounded contexts**:

1. `/achievements/me/badges` — Returns:
   - Badge metadata (name, description, icon, tier)
   - Achievement-specific progress
   - Badge rarity information
   - Achievement rules and requirements

2. `/users/me/badges` — Returns:
   - User's earned badges
   - Earned timestamps
   - User-specific badge state

These return **different data**. The Achievement module owns badge catalog and rules. The User module owns user-specific badge state.

**Final Recommendation:**

1. **KEEP BOTH** endpoints — they serve different purposes
2. **REJECT** the consolidation recommendation
3. Clarify the distinction in documentation

---

### Issue #13: Missing Category Filter for Tournaments

**Previous Recommendation:** Add `categoryId` filter to tournament listings.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Current | Recommended | Verdict |
|---------|-------------|---------|
| No category filter | Add `categoryId` | **ADD** |

**Architectural Justification:**

This is a legitimate missing filter. Tournaments are scoped to categories, and filtering by category is a natural query operation.

**Final Recommendation:**

1. **ADD** `categoryId` query parameter to `GET /tournaments`

---

### Issue #14: Missing Sort Controls for Categories/Tags

**Previous Recommendation:** Add sort parameter to category/tag list endpoints.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Current | Recommended | Verdict |
|---------|-------------|---------|
| No sorting | Add `sort` | **ADD** |

**Architectural Justification:**

Simple field sorting (alphabetical, by creation date) is a legitimate query parameter. This is distinct from algorithmic sorting (popular, trending).

**Final Recommendation:**

1. **ADD** `sort=name,createdAt` to `GET /categories`
2. **ADD** `sort=name,createdAt` to `GET /tags`

---

### Issue #15: Missing Date Filters for Discussions

**Previous Recommendation:** Add `createdAfter`/`createdBefore` to discussion threads.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Current | Recommended | Verdict |
|---------|-------------|---------|
| No date filter | Add date range | **ADD** |

**Final Recommendation:**

1. **ADD** `createdAfter` and `createdBefore` parameters to `GET /discussions/threads`

---

### Issue #16: Discussion Authorization Inconsistency

**Previous Recommendation:** Make thread/comment read operations public.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Endpoint | Current | Recommended | Verdict |
|----------|---------|------------|---------|
| `GET /discussions/threads/:threadId` | Auth required | Public | **APPROVE** |
| `GET /discussions/threads/:threadId/comments` | Auth required | Public | **APPROVE** |

**Architectural Justification:**

Public quiz discussions should be readable without authentication. This is:
- Better user experience (browse before signing up)
- Better for SEO (search engines can index)
- Consistent with other public resources

**Final Recommendation:**

1. **MAKE** thread and comment read operations `@Public()`
2. **KEEP** write operations authenticated

---

### Issue #17: Discussion Route Structure

**Previous Recommendation:** Simplify `/discussions/threads` to `/discussions`.

**RECOMMENDATION: REJECT**

#### Analysis:

| Current | Recommended | Verdict |
|---------|------------|---------|
| `/discussions/threads` | `/discussions` | **REJECT** |

**Architectural Justification:**

The `/discussions/threads/:threadId/comments/:commentId` structure is actually correct because:

1. **Threads and Comments are different resource types** — mixing them in the same namespace creates confusion
2. **Sub-resource hierarchy is semantically meaningful** — comments belong to threads
3. **Route conflicts would arise** — a thread ID could collide with a comment ID
4. **The REST nesting is appropriate** — `/discussions/threads/:id/comments` clearly expresses the relationship

The proposed simplification to `/discussions/:id` creates ambiguity:
- Is `:id` a thread or a comment?
- How do you distinguish between thread ID `abc123` and comment ID `abc123`?

**Final Recommendation:**

1. **KEEP** the current `/discussions/threads` and `/discussions/comments` structure
2. **DO NOT** simplify — the structure is architecturally sound

---

### Issue #18: Notification Module Incomplete Filtering

**Previous Recommendation:** Add `fromDate`/`toDate` to notifications.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Current | Recommended | Verdict |
|---------|-------------|---------|
| No date filter | Add date range | **ADD** |

**Final Recommendation:**

1. **ADD** `fromDate` and `toDate` parameters to `GET /notifications`

---

### Issue #19: Quiz Reviews Missing Sorting

**Previous Recommendation:** Add `sort` parameter to quiz reviews.

**RECOMMENDATION: KEEP AS RECOMMENDED**

#### Analysis:

| Current | Recommended | Verdict |
|---------|-------------|---------|
| Limited sort | Add `sort=newest,oldest` | **ADD** |

**Final Recommendation:**

1. **ADD** `sort=newest,oldest` (in addition to existing `helpful` sort)

---

## New Issues Discovered in Second Review

### Issue #20: Quiz Version Listing Is Not a Resource Endpoint

**Discovery:** `GET /quizzes/:id/versions` and `GET /quizzes/:id/versions/:versionId` represent **Quiz Versions**, which are sub-resources of Quiz.

**Classification:** Resource (not a capability)

**Current State:** These are correctly designed as sub-resources. No change recommended.

---

### Issue #21: Attempt Module Has Mixed Bounded Contexts

**Discovery:** Attempt-related endpoints are split across:
- `/quizzes/:quizId/attempts` (Quiz context)
- `/attempts/:id` (Attempt context)
- `/users/me/attempts` (User context)

**Classification:** Cross-context resource access

**Analysis:**

| Endpoint | Ownership | Verdict |
|----------|----------|---------|
| `POST /quizzes/:quizId/attempts` | Quiz context | Correct |
| `GET /attempts/:id` | Attempt context | Correct |
| `GET /users/me/attempts` | User context | Correct |

This split is **architecturally correct** — attempts can be accessed from multiple perspectives:
- Start an attempt → scoped to quiz
- Get attempt details → scoped to attempt
- List my attempts → scoped to user

**Recommendation:** No change needed. This is proper bounded context handling.

---

### Issue #22: Instance Module Missing Filter Capabilities

**Discovery:** `GET /instances` supports `status` and `difficulty` filtering (confirmed in controller). However, there is no way to filter by quiz or creator.

**Recommendation:**

| Add Filter | Priority | Verdict |
|------------|----------|---------|
| `?quizId={uuid}` | Medium | **ADD** |
| `?creatorId={uuid}` | Medium | **ADD** |

---

### Issue #23: Social Module Has Inconsistent Pagination

**Discovery:** Some social endpoints use cursor pagination (`/social/friends`, `/social/blocked`), others use offset (`/social/suggestions`, `/social/feed`).

**Analysis:**

| Endpoint | Pagination | Appropriate? |
|----------|-----------|-------------|
| `/social/friends` | Cursor | Yes — stable friend list |
| `/social/blocked` | Cursor | Yes — stable block list |
| `/social/suggestions` | Offset | Questionable — dynamic recommendations |
| `/social/feed` | Offset | Questionable — but feed is inherently unstable |

For suggestions and feed, offset pagination is arguably more appropriate because:
- These are not stable lists
- New suggestions appear continuously
- Cursor semantics become confusing

**Recommendation:**

1. **INVESTIGATE** whether `/social/suggestions` and `/social/feed` should use cursor pagination
2. **DO NOT** force cursor pagination universally — offset is appropriate for dynamic content

---

### Issue #24: Search Module Is Too Narrow

**Discovery:** `GET /search` searches across users, quizzes, and discussions — but does NOT search:
- Categories
- Tags
- Achievements
- Notifications
- Bookmarks

**Recommendation:**

| Add to Search | Priority |
|---------------|----------|
| Categories | Medium |
| Tags | Medium |

**Final Recommendation:**

1. **EVALUATE** expanding search to include categories and tags
2. **DO NOT** over-engineer — search scope should match user expectations

---

### Issue #25: Ranking Module Has Too Many My-Scoped Endpoints

**Discovery:** The ranking module exposes 9 `/me` scoped endpoints:
- `/leaderboard/me`
- `/leaderboard/me/rank`
- `/leaderboard/me/percentile`
- `/leaderboard/me/milestones`
- `/leaderboard/me/nearby`
- `/leaderboard/me/movement`
- `/leaderboard/me/peak-ranks`
- `/leaderboard/me/history`
- `/leaderboard/me/*` (many variations)

**Analysis:**

These are **NOT duplicates** — each represents a different derived metric from the ranking system:
- Current rank
- Rank for specific period
- Percentile position
- Achieved milestones
- Nearby competitors
- Rank movement
- Peak historical ranks
- Historical progression

These are legitimate **Business Capabilities** — they represent derived analytics, not filtered data.

**Recommendation:**

1. **KEEP ALL** `/leaderboard/me/*` endpoints
2. **DO NOT** attempt to consolidate them — they serve distinct analytical purposes

---

## Summary: Self-Critique Verdict

### Recommendations Still Strongly Recommended

| # | Recommendation | Rationale |
|---|-----------------|-----------|
| 7 | Remove duplicate review endpoint | Genuine duplicate |
| 8 | Remove duplicate discussions/me | Genuine duplicate |
| 9 | Remove duplicate discussion-profile | Genuine duplicate |
| 14 | Add sort to categories/tags | Missing filter |
| 15 | Add date filters to discussions | Missing filter |
| 16 | Make discussions public | Security improvement |
| 18 | Add date filters to notifications | Missing filter |
| 19 | Add sort to reviews | Missing filter |
| 26 | Add tagIds filter to tournaments | Missing filter (new) |

### Recommendations to Modify

| # | Previous | Modified | Rationale |
|---|---------|---------|-----------|
| 1 | Keep quiz status endpoints | **DEPRECATE** `/quizzes/me/drafts`, `/quizzes/me/published` | These are predefined filters, not capabilities |
| 2 | Keep category/tag sort endpoints | Keep popular/trending, add simple sort | Popular/trending are Business Capabilities |
| 3 | Keep tournament status endpoints | **DEPRECATE** status endpoints | Predefined filters — not capabilities |
| 11 | Merge social with type param | MERGE paths, but NOT into single endpoint | Each relationship type is a distinct resource |
| 13 | Add categoryId only | **ADD** categoryId AND tagIds | Tags are first-class discovery metadata |

### Recommendations to Reject

| # | Previous | Reason for Rejection |
|---|---------|---------------------|
| 4 | Consolidate discussions trending/search | These are Business Capabilities |
| 5 | Convert leaderboard to cursor | Offset is semantically correct for leaderboards |
| 6 | Convert achievements to cursor | Offset is appropriate for small stable collections |
| 10 | Merge /auth/me and /users/me | Different bounded contexts |
| 12 | Merge badge endpoints | Different bounded contexts |
| 17 | Simplify discussion routes | Current structure is architecturally correct |

### New Recommendations Discovered

| # | Recommendation | Priority |
|---|----------------|----------|
| 20 | Keep quiz versions as sub-resources | N/A (already correct) |
| 21 | Keep attempt module split contexts | N/A (already correct) |
| 22 | Add quizId/creatorId filters to instances | Medium |
| 23 | Investigate social suggestions/feed pagination | Low |
| 24 | Evaluate expanding search scope | Low |
| 25 | Keep ranking /me/* endpoints as-is | N/A (already correct) |
| 26 | Add tag filtering to tournaments | High — missing filter |

---

## Final Revised API Surface (Corrected)

### Quiz Module

**Resources:**
```
POST   /quizzes                                    # Create
GET    /quizzes                                   # List with filters
GET    /quizzes/:id                               # Get by ID
PATCH  /quizzes/:id                               # Update
DELETE /quizzes/:id                               # Delete
```

**List Filters (Query Parameters):**
```
GET /quizzes
    ?creatorId={uuid}
    ?status={draft|published}
    ?categoryId={uuid}
    ?tagIds={uuid1,uuid2}                       # AND semantics
    ?difficulty={easy|medium|hard}
    ?sort={newest|popular|trending}
    ?featured={true}
    ?cursor={cursor}
    ?limit={1-50}
```

**Note on status endpoints:**
`/quizzes/me/drafts` and `/quizzes/me/published` are technically predefined filters (`creatorId=me&status=draft`). However, they serve as **common navigation paths** for authenticated users managing their content. These can be kept as convenience endpoints OR deprecated in favor of query params. The decision should be based on whether the implementation differs from the base endpoint.

**Business Capabilities (keep as dedicated endpoints):**
```
GET    /quizzes/trending                           # Ranking algorithm — keep dedicated
GET    /quizzes/popular                           # Popularity algorithm — keep dedicated
GET    /quizzes/featured                          # Editorial curation — keep dedicated
GET    /quizzes/:id/stats                         # Analytics computation
GET    /quizzes/:id/similar                      # Similarity algorithm
```

**Sub-resources:**
```
POST   /quizzes/:id/versions                      # Quiz versions
GET    /quizzes/:id/versions                      # List versions
GET    /quizzes/:id/versions/:versionId           # Get version
... (version CRUD)
POST   /quizzes/:id/versions/:versionId/questions
```

### Category Module

**Resources:**
```
POST   /categories                               # Create
GET    /categories                               # List (add: sort=name,createdAt)
GET    /categories/:id                           # Get by ID
PATCH  /categories/:id                          # Update
DELETE /categories/:id                          # Delete
```

**Business Capabilities (keep as-is):**
```
GET    /categories/popular                       # Keep dedicated
GET    /categories/trending                       # Keep dedicated
GET    /categories/:id/quizzes                   # Category-scoped quizzes
GET    /categories/:id/related                   # Related categories
```

**Actions:**
```
POST   /categories/:id/follow                    # Follow
DELETE /categories/:id/follow                    # Unfollow
```

### Tag Module

**Same pattern as Category Module — no changes recommended.**

### Tournament Module

**Resources:**
```
POST   /tournaments                             # Create
GET    /tournaments                             # List with filters
GET    /tournaments/:id                         # Get by ID
PATCH  /tournaments/:id                         # Update
DELETE /tournaments/:id                         # Soft delete
```

**List Filters (Query Parameters):**
```
GET /tournaments
    ?status={upcoming|active|completed|registration|cancelled}
    ?categoryId={uuid}
    ?tagIds={uuid1,uuid2}                     # AND semantics — tournament must have ALL tags
    ?creatorId={uuid}
    ?sort={startAt|name}
    ?cursor={cursor}
    ?limit={1-100}
```

**Business Capabilities (keep as-is):**
```
GET    /tournaments/:id/stats                    # Analytics
GET    /tournaments/:id/related                  # Related tournaments
GET    /tournaments/:id/winners                # Winner list
```

**Actions:**
```
POST   /tournaments/:id/cancel
POST   /tournaments/:id/register
POST   /tournaments/:id/withdraw
GET    /tournaments/:id/leaderboard
GET    /tournaments/:id/participants
POST   /tournaments/:id/rounds/:roundId/attempts
GET    /tournaments/:id/my-standing
```

**Deprecated Endpoints (redirect to query params):**
```
GET /tournaments/upcoming    → GET /tournaments?status=upcoming
GET /tournaments/active     → GET /tournaments?status=active
GET /tournaments/completed  → GET /tournaments?status=completed
```

**Why deprecate status endpoints?**

Tournament status (`upcoming`, `active`, `completed`) is a **predefined filter**, not a **business capability**:
- Implementation: Pure `WHERE status = X` query
- No computation or algorithm
- Same caching strategy as base resource
- No specialized response DTO

High traffic or UI convenience does NOT justify dedicated endpoints. The API should model the domain, not the UI.

### Discussion Module

**Resources:**
```
GET    /discussions/threads                      # List (add: quizId, authorId, hasComments, status, dateRange)
GET    /discussions/threads/:threadId           # Get (make public)
PATCH  /discussions/threads/:threadId           # Update
DELETE /discussions/threads/:threadId          # Delete
POST   /discussions/threads/:threadId/comments # Add comment
GET    /discussions/threads/:threadId/comments # List comments (make public)
... (comment CRUD)
```

**Business Capabilities (keep as-is):**
```
GET    /discussions/trending                     # Keep dedicated
GET    /discussions/search                      # Keep dedicated
GET    /discussions/unanswered                  # Keep dedicated
```

**Actions:**
```
POST   /discussions/threads/:threadId/subscribe
DELETE /discussions/threads/:threadId/subscribe
POST   /discussions/threads/:threadId/save
DELETE /discussions/threads/:threadId/save
POST   /discussions/threads/:threadId/solve
DELETE /discussions/threads/:threadId/solve
POST   /discussions/threads/:threadId/close
POST   /discussions/threads/:threadId/reopen
... (moderation actions)
```

**Note:** Route structure `/discussions/threads/:id` is architecturally correct — DO NOT simplify.

### Social Module

**Resources (User-scoped):**
```
GET    /users/:userId/followers                   # User's followers
GET    /users/:userId/following                   # Users this user follows
GET    /users/:userId/friends                    # User's friends
```

**Social Actions:**
```
POST   /social/follow/:userId                    # Follow user
DELETE /social/follow/:userId                   # Unfollow user
POST   /social/block/:userId                     # Block user
DELETE /social/block/:userId                    # Unblock user
POST   /social/friend-request/:userId           # Send friend request
POST   /social/friend-requests/:id/respond      # Respond to request
DELETE /social/friend-requests/:id              # Cancel request
```

**Business Capabilities:**
```
GET    /social/feed                             # Social feed — algorithm-driven
GET    /social/suggestions                      # Friend/content suggestions
GET    /social/friends/leaderboard               # Friend leaderboard
GET    /social/users/search                      # User search
GET    /social/users/trending                    # Trending users
```

**Deprecated Endpoints:**
```
/social/followers    → /users/{userId}/followers
/social/following    → /users/{userId}/following
/social/friends      → /users/{userId}/friends
```

### Ranking Module

**Resources:**
```
GET    /leaderboard                             # Global leaderboard
GET    /leaderboard/:userId                     # User's rank
```

**List Filters:**
```
GET /leaderboard
    ?period={daily|weekly|monthly|yearly|alltime}
    ?cursor={cursor}
    ?limit={1-100}
```

**Business Capabilities (keep all dedicated):**
```
GET    /leaderboard/distribution                 # Rank distribution stats
GET    /leaderboard/top-movers                   # Top rank gainers
GET    /leaderboard/me                          # Current user rank + stats
GET    /leaderboard/me/rank                     # Rank for specific period
GET    /leaderboard/me/percentile               # Percentile calculation
GET    /leaderboard/me/milestones               # Achievement milestones
GET    /leaderboard/me/nearby                   # Nearby competitors
GET    /leaderboard/me/movement                 # Rank movement
GET    /leaderboard/me/peak-ranks              # Historical peak ranks
GET    /leaderboard/me/history                  # Rank history
```

**Note:** Offset pagination is correct for leaderboards. DO NOT convert to cursor.

### Achievement Module

**Resources:**
```
GET    /achievements/badges                     # Badge catalog
GET    /achievements/badges/:id                 # Badge details
GET    /users/me/badges                        # User's earned badges
GET    /users/:userId/badges                   # User's earned badges
```

**Business Capabilities:**
```
GET    /achievements/me/badges/:id/progress     # Badge progress calculation
GET    /achievements/me/achievements/history    # Achievement history
GET    /achievements/me/badges/analytics       # Badge analytics
```

**Note:** `/achievements/me/badges` and `/users/me/badges` serve different purposes:
- Achievement module: Badge metadata, rules, rarity, progress
- User module: Earned badges with timestamps, user-specific state

Both should be kept — they return different data from different contexts.

### Auth Module

**Authentication Context:**
```
GET    /auth/me                                 # Session, tokens, security context
POST   /auth/login                              # Login
POST   /auth/logout                             # Logout
POST   /auth/logout-all                         # Logout all sessions
GET    /auth/sessions                          # List active sessions
DELETE /auth/sessions/:sessionId               # Revoke session
DELETE /auth/sessions/others                  # Revoke other sessions
POST   /auth/register                           # Register
POST   /auth/verify-email                       # Verify email
POST   /auth/forgot-password                    # Forgot password
POST   /auth/reset-password                     # Reset password
POST   /auth/change-password                    # Change password
POST   /auth/refresh-token                      # Refresh token
... (other auth operations)
```

**User Context:**
```
GET    /users/me                                # User profile, settings, activity
PATCH  /users/me                               # Update profile
... (other user operations)
```

**Why keep both `/auth/me` and `/users/me`?**

These are **different bounded contexts** with different:
- **Data returned:** Auth returns session/security context; User returns profile/settings
- **Refresh semantics:** Auth checks token validity; User fetches profile data
- **Caching strategies:** Auth: short TTL; User: longer TTL
- **Security models:** Auth module handles authentication; User module handles authorization

Conflating these would violate bounded context boundaries.

### Instance Module

**Resources:**
```
POST   /instances                              # Create instance
GET    /instances                              # List instances
GET    /instances/:id                         # Get instance
```

**List Filters:**
```
GET /instances
    ?status={waiting|in_progress|completed}
    ?difficulty={easy|medium|hard}
    ?quizId={uuid}                          # Missing filter — ADD
    ?creatorId={uuid}                       # Missing filter — ADD
    ?cursor={cursor}
    ?limit={1-50}
```

**Actions:**
```
POST   /instances/:id/join                     # Join instance
POST   /instances/:id/start                   # Start instance
POST   /instances/:id/close                  # Close instance
GET    /instances/:id/players                 # List players
GET    /instances/:id/leaderboard            # Instance leaderboard
```

### Notification Module

**Resources:**
```
GET    /notifications                          # List notifications
GET    /notifications/:id                      # Get notification
PATCH  /notifications/:id                      # Update notification
DELETE /notifications/:id                      # Delete notification
```

**List Filters:**
```
GET /notifications
    ?unreadOnly={boolean}
    ?type={notification_type}
    ?fromDate={ISO8601}                       # Missing filter — ADD
    ?toDate={ISO8601}                         # Missing filter — ADD
    ?cursor={cursor}
    ?limit={1-50}
```

**Actions:**
```
POST   /notifications/:id/read                # Mark as read
POST   /notifications/:id/unread             # Mark as unread
POST   /notifications/read-all               # Mark all as read
DELETE /notifications/read                   # Delete read notifications
```

**Preferences:**
```
GET    /notifications/preferences            # Get preferences
PATCH  /notifications/preferences           # Update preferences
```

### Search Module

**Resource:**
```
GET    /search                                # Search all resources
```

**Filters:**
```
GET /search
    ?q={query}
    ?type={user|quiz|discussion|category|tag}  # Filter by resource type
    ?cursor={cursor}
    ?limit={1-50}
```

**Note:** Current implementation searches users, quizzes, and discussions. Should evaluate expanding to categories and tags (low priority).

---

## Revised Prioritization

### Phase 1 (Immediate - Missing Filters)
1. Add `status`, `categoryId`, `tagIds` filters to `GET /tournaments`
2. Add `creatorId` filter to `GET /quizzes`
3. Add `sort=name,createdAt` to `GET /categories` and `GET /tags`
4. Add date filters to `GET /discussions/threads`
5. Add date filters to `GET /notifications`
6. Add sort options to `GET /quizzes/:quizId/reviews`

### Phase 2 (Short-term - Remove Predefined Filter Endpoints) ✅ COMPLETED
1. ~~Deprecate~~ **Removed** `GET /tournaments/upcoming` → use `GET /tournaments?status=upcoming`
2. ~~Deprecate~~ **Removed** `GET /tournaments/active` → use `GET /tournaments?status=active`
3. ~~Deprecate~~ **Removed** `GET /tournaments/completed` → use `GET /tournaments?status=completed`

### Phase 3 (Short-term - Remove Duplicate Endpoints) ✅ COMPLETED
1. ~~Deprecate~~ **Removed** `GET /quizzes/:quizId/reviews/me` → use `GET /users/me/reviews/:quizId`
2. ~~Deprecate~~ **Removed** `GET /discussions/me` → use `GET /users/me/discussions`
3. ~~Deprecate~~ **Removed** `GET /discussions/users/:userId/discussion-profile` → use `GET /users/:userId/discussion-profile`
4. ~~Deprecate~~ **Removed** social relationship endpoints under `/social` → use `/users/...` variants:
   - `GET /social/friends` → `GET /users/:userId/friends`
   - `GET /social/followers` → `GET /users/:userId/followers`
   - `GET /social/following` → `GET /users/:userId/following`

### Phase 4 (Medium-term - Authorization) ✅ COMPLETED
1. Made `GET /discussions/threads/:threadId` public (no auth required)
2. Made `GET /discussions/threads/:threadId/comments` public (no auth required)

### Phase 5 (Long-term - Enhancement) ✅ COMPLETED
1. Expanded search scope to include categories and tags (`GET /search` now returns `categories` and `tags`)
2. Added filters to instance listings: `quizId` and `creatorId` (`GET /instances`)
3. Social suggestions/feed pagination already uses offset-based pagination (no changes needed)

---

## Deep-Dive Analysis: Challenging Own Recommendations

### Question 1: Tournament Status Endpoints

#### Self-Critique of Previous Justification

My previous recommendation to keep `/tournaments/upcoming`, `/tournaments/active`, `/tournaments/completed` was **architecturally wrong**. The justification ("high-traffic UX paths") conflated client convenience with API design.

#### Analysis: Should Dedicated Status Endpoints Exist?

**If they are identical to `GET /tournaments?status=X`:**
- Same SQL query
- Same response DTO
- Same caching strategy
- Same authorization

Then keeping both is **pure API surface redundancy with no architectural justification**.

#### Criteria: Predefined Filter vs. Business Capability

| Criterion | Predefined Filter | Business Capability |
|-----------|------------------|---------------------|
| **Computation** | None — simple WHERE clause | Algorithm, ML model, or aggregation |
| **Result Determinism** | Same input → same output | May vary between calls |
| **Ranking** | None — explicit sort param | Proprietary ranking algorithm |
| **Data Source** | Single table/entity | Multiple tables, external services |
| **Caching Strategy** | Identical to base resource | May require separate cache |

**For tournament status:**
- `WHERE status = 'upcoming' AND startAt > NOW()` is a pure WHERE clause
- No algorithm, no computation
- Deterministic result
- Same cache as base resource

**Conclusion:** Status filtering is a predefined filter, not a business capability.

#### Does Traffic/UI Convenience Justify Endpoints?

**No.** Traffic volume and UI convenience are **implementation details** that should not drive API contracts:

1. API contracts should model the domain, not client UI patterns
2. Different clients have different needs — web, mobile, admin tools
3. Query parameters are equally discoverable: `/tournaments?status=upcoming`
4. Clients can create local aliases or SDK wrappers

#### Decision Matrix for Future Endpoints

| Endpoint | Type | Recommendation |
|----------|------|----------------|
| `/tournaments/recommended` | Business Capability | **Keep dedicated** — recommendation algorithm |
| `/tournaments/free` | Predefined Filter | Query param: `?tier=free` |
| `/tournaments/premium` | Predefined Filter | Query param: `?tier=premium` |
| `/tournaments/live` | Predefined Filter | Query param: `?status=live` |
| `/tournaments/weekend` | Ambiguous | If time-based: `?days=saturday,sunday`; If featured: **dedicated** |

**Decision Algorithm:**
```
Is this a predefined filter?
├── Does it require computation/algorithm?
│   └── YES → Business Capability → Keep dedicated endpoint
├── Is it a boolean/status flag on the entity?
│   └── YES → Predefined Filter → Query parameter
└── Does it require aggregation or derivation?
    └── YES → Business Capability → Keep dedicated endpoint
```

#### Final Verdict for Tournament Status Endpoints

**REJECT** keeping dedicated status endpoints.

**UPDATE:** Recommend deprecating:
- `/tournaments/upcoming` → `GET /tournaments?status=upcoming`
- `/tournaments/active` → `GET /tournaments?status=active`
- `/tournaments/completed` → `GET /tournaments?status=completed`

---

### Question 2: Missing Tag Filtering

#### Analysis: Should Tag Filtering Exist?

**Yes.** My previous recommendation was **incomplete**. I noted tournaments support `categoryId` but failed to add `tagIds`.

**Why tag filtering matters:**
1. Tournaments can have many tags (many-to-many relationship)
2. Tags are for discoverability — users browse by tags
3. Users interested in "JavaScript" AND "Algorithms" should find tournaments matching both

#### Single Tag vs. Multiple Tags

| Option | Example | Tradeoffs |
|--------|---------|-----------|
| Single tag | `?tagId={uuid}` | Only works for one tag |
| Multiple tags (comma-separated) | `?tagIds=uuid1,uuid2` | Clear semantics, standard pattern |
| Multiple tags (repeated) | `?tagIds=uuid1&tagIds=uuid2` | NestJS supports natively as array |

**Recommendation:** `?tagIds=uuid1,uuid2` (comma-separated UUIDs)

**Justification:**
1. UUIDs are unambiguous — no slug collision issues
2. Consistent with existing `tagIds` pattern in quiz listing
3. Natural array parsing in NestJS/Express
4. More explicit than slug-based approach

#### AND vs. OR Semantics

| Semantics | Behavior | Use Case |
|-----------|----------|----------|
| **OR** (any tag) | Tournament has tag1 OR tag2 | Broad discovery |
| **AND** (all tags) | Tournament has tag1 AND tag2 | Narrow discovery |

**Recommendation: AND by default**

**Justification:**
1. User intent is typically AND when filtering — narrow down results
2. OR is the exception, better served by search
3. Consistency with faceted search (e-commerce, documentation)
4. Most filter UIs default to AND — users expect narrowing behavior

**DTO Example:**
```typescript
class ListTournamentsQueryDto {
  // ... existing filters ...

  @ApiPropertyOptional({
    description: 'Filter by tag UUIDs. Tournament must have ALL specified tags (AND semantics).',
    type: String,
    isArray: true,
    format: 'uuid',
    example: ['770e8400-e29b-71d4-a716-446655440000'],
  })
  tagIds?: string[];
}
```

---

## Key Architectural Principles (Corrected)

### 1. API Models the Domain, Not the UI
Traffic/UX convenience is not a valid justification for dedicated endpoints.

### 2. Predefined Filters = Query Parameters
If it's a WHERE clause, it belongs in `?param=value`.

### 3. Business Capabilities = Dedicated Endpoints
If it involves computation/algorithm, it deserves its own endpoint.

### 4. Bounded Context Ownership
Tournament listing is owned by Tournament module; category/tag filtering are natural queries on that resource.

### 5. AND by Default for Multi-Value Filters
Users filter to narrow, not broaden.

### 6. Pagination Strategy Depends on Data Characteristics
- **Cursor:** Dynamic content (feeds, activity streams)
- **Offset:** Stable content (leaderboards, user lists, badge catalogs)

One size does not fit all.

### 7. Endpoint Count Is Not the Goal
A well-designed API has as many endpoints as necessary to represent the domain accurately.

### 8. Duplicate ≠ Different Purpose
`/auth/me` and `/users/me` return different data with different semantics.
