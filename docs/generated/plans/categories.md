# Category Module Expansion Plan

## Summary

Expand the current `category` module from CRUD-only into a fuller category domain that supports:

- category-scoped quiz discovery
- category rankings (`popular`, `trending`)
- category follows
- category restore
- category-owned analytics transport

Keep the current layered structure:

- controller -> application service -> domain service -> repository
- reuse existing quiz listing and quiz analytics services instead of duplicating business logic

## Key Changes

### Public endpoints to add

Add these routes to the category area:

- `GET /categories/:slug/quizzes`
  Resolve the active category by slug, then return quizzes using the same response shape and cursor pagination as `GET /quizzes`.

- `GET /categories/popular`
  Public endpoint.
  Query: `limit` with default `10`, max `100`.
  Returns ranked categories using aggregated quiz `popularityScore`.

- `GET /categories/trending`
  Public endpoint.
  Query: `limit` with default `10`, max `100`.
  Returns ranked categories using aggregated quiz `trendingScore`.

- `POST /categories/:id/follow`
  Authenticated.
  Idempotent success if already followed.
  Return message response.

- `DELETE /categories/:id/follow`
  Authenticated.
  Idempotent success if already unfollowed.
  Return message response.

- `POST /categories/:id/restore`
  Admin-only.
  Restores a soft-deleted category and returns the restored category.

- `GET /users/me/followed-categories`
  Authenticated.
  Cursor-paginated.
  Returns followed categories plus `followedAt`.

- `GET /categories/:id/analytics`
  Keep the existing analytics payload, but move route ownership into the category module so all category endpoints are grouped together.

### Schema changes

Add a new table: `category_follows`.

Columns:

- `followId`
- `userId`
- `categoryId`
- `createdAt`
- `deletedAt`

Constraints and indexes:

- unique active pair on `(userId, categoryId)` where `deleted_at IS NULL`
- index on `userId`
- index on `categoryId`
- index on `deletedAt`
- foreign key `userId -> users.userId` with cascade delete
- foreign key `categoryId -> categories.categoryId` with cascade delete

Update schema exports in `src/core/database/schema/index.ts`.

Update relations in `src/core/database/schema/relations.ts`:

- add `categoryFollowsRelations`
- extend `usersRelations` with category follows
- extend `categoriesRelations` with category follows

Use soft delete for unfollow, not hard delete.

### Category module changes

Extend the category repository port and repository implementation with:

- `findByIdIncludingDeleted`
- `restore`
- `followCategory`
- `unfollowCategory`
- `listFollowedCategories`
- `getPopularCategories`
- `getTrendingCategories`

Extend the category domain service with:

- `getCategoryQuizzesBySlug`
- `followCategory(userId, categoryId)`
- `unfollowCategory(userId, categoryId)`
- `restoreCategory(categoryId)`
- `listFollowedCategories(userId, query)`
- `getPopularCategories(limit)`
- `getTrendingCategories(limit)`

Behavior rules:

- follow requires category to exist and be active
- follow is idempotent
- unfollow is idempotent
- restore only works on soft-deleted categories
- restore must fail if active name/slug conflicts now exist

### Reuse existing quiz and analytics logic

Import `QuizModule` into `CategoryModule`.

Reuse:

- `QuizApplicationService` for `GET /categories/:slug/quizzes`
- `QuizAnalyticsService` for `GET /categories/:id/analytics`

Do not rebuild quiz list mapping or analytics calculations inside the category module.

After adding category-owned analytics transport:

- remove the existing `GET /categories/:categoryId/analytics` route from `QuizAnalyticsController`
- keep the analytics service implementation in quiz domain

### Ranking logic

For `popular` and `trending`, rank categories by aggregating quiz analytics from active quizzes linked through `quiz_categories`.

Recommended aggregation:

- `popular`: `SUM(popularity_score)`
- `trending`: `SUM(trending_score)`

Filtering:

- exclude deleted categories
- exclude deleted quizzes
- exclude hidden quizzes
- exclude categories with no active quizzes

Tie-breakers:

- first by aggregated score desc
- then by total attempts desc
- then by category id asc

Return:

- rank
- category identity fields
- summary metrics used by clients

### DTOs and response shapes

Add DTOs for:

- ranking query (`limit`)
- followed categories query (`cursor`, `limit`)
- followed category item with `followedAt`
- followed categories list response
- ranked category response
- restore response if needed
- follow/unfollow message responses if explicit DTOs are preferred

`GET /categories/:slug/quizzes` should reuse the existing quiz list response contract.

### Controller routing order

Avoid route collisions with `:slug`.

Recommended order of category routes:

- `GET /categories/popular`
- `GET /categories/trending`
- `GET /categories/:slug/quizzes`
- `GET /categories/:id/analytics`
- `POST /categories/:id/follow`
- `DELETE /categories/:id/follow`
- `POST /categories/:id/restore`
- `GET /categories/:slug`
- existing create/update/delete routes

Place `GET /users/me/followed-categories` in a controller with root `@Controller()` or another non-conflicting controller path so it does not collide with `categories/:slug`.

## Test Plan

### Follow and unfollow

- follow active category creates active follow
- duplicate follow succeeds without duplicate active row
- refollow after unfollow restores follow correctly
- unfollow soft-deletes active follow
- unfollow when not followed still succeeds
- follow deleted category returns not found
- follow missing category returns not found

### Restore

- restore soft-deleted category succeeds
- restore missing category returns not found
- restore active category fails with defined error
- restore fails if slug conflict now exists
- restore fails if name conflict now exists

### Category quizzes

- valid category slug returns quiz list envelope
- missing slug returns category not found
- deleted category slug returns category not found
- quiz filters like difficulty/tag still work
- pagination cursor works exactly like `/quizzes`

### Rankings

- popular categories sort by aggregated popularity score
- trending categories sort by aggregated trending score
- hidden/deleted quizzes do not contribute
- deleted categories do not appear
- categories without active quizzes do not appear
- limit validation works

### Followed categories

- returns followed categories ordered by newest follow first
- includes `followedAt`
- excludes deleted follow rows
- excludes deleted categories
- cursor pagination remains stable for equal timestamps

### Analytics

- `GET /categories/:id/analytics` keeps current payload behavior
- route exists only once after transport move
- missing category analytics follows the chosen not-found behavior consistently

## Assumptions and defaults

- `POST /categories/:id/restore` is admin-only
- follow endpoints and `GET /users/me/followed-categories` require authentication only
- `GET /categories/:slug/quizzes` reuses the exact `/quizzes` response format
- category ranking is based on aggregated existing quiz analytics, not a new scoring formula
- analytics calculation stays in quiz domain; only route ownership moves
- ranking endpoints use simple `limit` query without cursor pagination in v1
- follow/unfollow are idempotent by design
