# Migration Plan: Many-to-Many → 1-N (Single Category per Quiz)

## Goal

Change the quiz-category relationship from **many-to-many** (via `quiz_categories` join table) to **one-to-many** (one quiz belongs to exactly one category; one category can have many quizzes).

## Core Database Change

- **Drop** the `quiz_categories` join table
- **Add** a `category_id` column directly on the `quizzes` table (nullable for migration, NOT NULL later)

---

## Phase 1: Database Schema & Migration

### `src/core/database/schema/quiz/schema.ts`
- Remove the entire `quizCategories` table definition
- Add `categoryId: uuid('category_id')` column to the `quizzes` table, with a foreign key to `categories(category_id)`
- Add an index on `quizzes.category_id` for performance

### `src/core/database/schema/quiz/relations.ts`
- Remove the `quizCategoriesRelations` export entirely

### Migration file (generated via `pnpm db:generate`)
1. Drop `quiz_categories` table
2. Add `category_id uuid` column to `quizzes`
3. Add FK constraint `quizzes.category_id → categories.category_id`
4. Drop the 3 indexes on `quiz_categories` (`idx_quiz_categories_category_id`, `idx_quiz_categories_category_quiz`, `idx_quiz_categories_quiz_id`)

### Data migration (inside the migration)
```sql
-- Migrate existing quiz-category assignments:
-- If a quiz has multiple categories, pick one arbitrarily (e.g., the first by category_id)
INSERT INTO quizzes (quiz_id, category_id)
SELECT DISTINCT ON (qc.quiz_id) qc.quiz_id, qc.category_id
FROM quiz_categories qc
ORDER BY qc.quiz_id, qc.category_id;

-- For quizzes without any category assignment, leave NULL (enforce NOT NULL in a follow-up migration)
```

---

## Phase 2: DTOs (Request)

### `src/modules/quiz/dto/request/create-quiz.dto.ts` (lines 148–161)
- Change `categoryIds?: string[]` → `categoryId?: string`
- Replace `@IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsUUID('4', { each: true })` with `@IsUUID('4')`
- Update `ApiPropertyOptional` to `type: String, format: 'uuid'` (remove `type: Array`, `maxItems`)

### `src/modules/quiz/dto/request/update-quiz.dto.ts` (lines 100–112)
- Same changes as `create-quiz.dto.ts`

### No changes needed:
- `list-quizzes-query.dto.ts` — already uses singular `categoryId?: string`
- `list-category-quizzes-query.dto.ts` — derives category from path slug

---

## Phase 3: Domain Commands & Types

### `src/modules/quiz/domain/types/*` (command types)
- `CreateQuizCommand`: `categoryIds: string[]` → `categoryId: string`
- `UpdateQuizCommand`: `categoryIds?: string[] | null` → `categoryId?: string | null`

---

## Phase 4: Application Service

### `src/modules/quiz/application/quiz.application.service.ts`

| Line | Current | New |
|------|---------|-----|
| 51 | `categoryIds: dto.categoryIds ?? []` | `categoryId: dto.categoryId` |
| 67 | `categoryId: dto.categoryId` (in filters) | No change (already singular) |
| 267 | `categoryIds: dto.categoryIds` | `categoryId: dto.categoryId` |

---

## Phase 5: Command Service

### `src/modules/quiz/domain/quiz/quiz-command.service.ts`

| Line | Current | New |
|------|---------|-----|
| 63 | `const categoryIds = normalizeLinkIds(command.categoryIds)` | `const categoryId = command.categoryId` |
| 64 | `const tagIds = normalizeLinkIds(command.tagIds)` | No change |
| 138 | `const categoryIds = hasCategoryIds ? normalizeLinkIds(command.categoryIds ?? undefined) : null` | `const categoryId = hasCategoryIds ? command.categoryId : null` |

---

## Phase 6: Repository (Major Changes)

### `src/modules/quiz/domain/ports/quiz-repository.port.ts`
- `CreateQuizWithInitialVersionPayload`: `categoryIds: string[]` → `categoryId: string`
- `UpdateQuizLinksParams`: `categoryIds: string[] | null` → `categoryId: string | null`

### `src/modules/quiz/infrastructure/repositories/quiz.repository.ts`

| Method | Current approach | New approach |
|--------|-----------------|--------------|
| `listQuizzes()` (lines 183–191) | `EXISTS (SELECT 1 FROM quiz_categories WHERE ...)` | `quizzes.category_id = ${params.filters.categoryId}` |
| `findRelatedQuizzes()` (lines 369–485) | Subquery with `quizCategories` joins | Direct `quizzes.category_id` comparison |
| `createQuizWithInitialVersion()` (lines 551–559) | `INSERT INTO quiz_categories ...` | `UPDATE quizzes SET category_id = ? WHERE quiz_id = ?` |
| `updateQuizWithLinks()` (lines 607–618) | DELETE + INSERT into `quiz_categories` | `UPDATE quizzes SET category_id = ? WHERE quiz_id = ?` |
| `getQuizById()` / `getQuizBySlug()` | No category columns in SELECT | Add `category_id` to SELECT |

---

## Phase 7: Analytics & Recommendation Repositories

All files that currently join with `quiz_categories`:

| File | What changes |
|------|-------------|
| `quiz-analytics.repository.ts` | Replace `quizCategories` joins with `quizzes.category_id` |
| `quiz-recommendation.repository.ts` | Replace category overlap scoring with direct `quizzes.category_id` |
| `category.repository.ts` | Replace `quizCategories` LEFT JOINs with `quizzes.category_id` |
| `attempt.repository.ts` | Replace EXISTS subqueries on `quiz_categories` with `quizzes.category_id` |
| `bookmark.repository.ts` | Replace `quizCategories` joins with `quizzes.category_id` |
| `discussion.repository.ts` | Replace `quiz_categories` subquery with `quizzes.category_id` |

---

## Phase 8: Response DTOs & Mappers

### `src/modules/quiz/dto/response/quiz-list-item.dto.ts`
- Add `categoryId?: string` (singular, not array)
- Optionally add denormalized `categorySlug` and `categoryName` if needed by clients

### `src/modules/quiz/dto/response/quiz-response.dto.ts`
- Change `categoryIds?: string[]` → `categoryId?: string` if it exists
- Remove the array-based category field

### `src/modules/quiz/dto/response/quiz-list-response.dto.ts`
- No structural change needed

### `src/modules/quiz/mappers/quiz-response.mapper.ts`
- Map `row.categoryId` → single `categoryId` field

### `src/modules/category/transport/presenters/category.presenter.ts`
- No structural changes needed

---

## Phase 9: Seed Commands

### `src/commands/seed/development/quiz.seed.ts` — `ensureTaxonomy()` function
- Replace `INSERT INTO quiz_categories` with `UPDATE quizzes SET category_id = ? WHERE quiz_id = ?`
- Use `quiz.seed.categorySlug` (already present) to look up the `categoryId`

### `src/commands/seed/foundation/category.seed.ts`
- No changes needed

### `SEED_RECORD.md`
- Regenerate after migration by re-running `pnpm db:seed:all`

---

## Phase 10: Category Query Service

### `src/modules/category/application/category-query.service.ts`
- `getCategoryQuizzesBySlug()` — the delegation to `quizApplicationService.listQuizzes({ ..., categoryId })` continues to work with no changes (the field is already singular)

---

## Phase 11: Other Affected Modules

| Module | What to check |
|--------|---------------|
| Category analytics mapper | If it references `categoryIds` arrays in quiz objects |
| Category analytics DTO | Same as above |
| Any endpoint returning quizzes with categories | Ensure it uses the new singular `categoryId` |
| Tournament module | If tournaments reference `quizCategories` (unlikely) |

---

## Phase 12: Migration Execution Order

1. Generate migration with `pnpm db:generate`
2. Edit the migration to include the data migration step
3. Run `pnpm db:migrate`
4. Run `pnpm db:seed:all` to regenerate seed data
5. Apply all code changes (Phases 2–11)
6. Run `pnpm build` and verify TypeScript compilation
7. Run tests

---

## Phase 13: Testing Checklist

- [ ] `POST /api/v1/quizzes` — create with single `categoryId` in body
- [ ] `PATCH /api/v1/quizzes/:id` — update category
- [ ] `GET /api/v1/quizzes` — filter by `categoryId` query param
- [ ] `GET /api/v1/quizzes/:id` — response includes `categoryId`
- [ ] `GET /api/v1/categories/:slug/quizzes` — list quizzes in a category
- [ ] `GET /api/v1/quizzes/trending?categoryId=...` — filter works
- [ ] `GET /api/v1/quizzes/popular?categoryId=...` — filter works
- [ ] Seed data regenerates correctly
- [ ] All existing tests pass

---

## Summary of Files to Modify

| # | File | Change type |
|---|------|-------------|
| 1 | `src/core/database/schema/quiz/schema.ts` | Remove `quizCategories` table, add `category_id` to `quizzes` |
| 2 | `src/core/database/schema/quiz/relations.ts` | Remove `quizCategoriesRelations` |
| 3 | Migration file (new) | Drop table, add column, migrate data |
| 4 | `src/modules/quiz/dto/request/create-quiz.dto.ts` | `categoryIds?: string[]` → `categoryId?: string` |
| 5 | `src/modules/quiz/dto/request/update-quiz.dto.ts` | Same as above |
| 6 | Domain command types | `categoryIds` → `categoryId` |
| 7 | `src/modules/quiz/domain/quiz/quiz-command.service.ts` | Remove `normalizeLinkIds` for categories |
| 8 | `src/modules/quiz/application/quiz.application.service.ts` | Pass single `categoryId` |
| 9 | `src/modules/quiz/domain/ports/quiz-repository.port.ts` | Update payload types |
| 10 | `src/modules/quiz/infrastructure/repositories/quiz.repository.ts` | Rewrite category operations |
| 11 | `src/modules/quiz/domain/analytics/quiz-analytics.repository.ts` | Replace join table queries |
| 12 | `src/modules/quiz/infrastructure/repositories/quiz-recommendation.repository.ts` | Replace join table queries |
| 13 | `src/modules/category/infrastructure/repositories/category.repository.ts` | Replace join table joins |
| 14 | `src/modules/attempt/infrastructure/repositories/attempt.repository.ts` | Replace EXISTS subqueries |
| 15 | `src/modules/bookmark/infrastructure/repositories/bookmark.repository.ts` | Replace join table joins |
| 16 | `src/modules/discussion/infrastructure/repositories/discussion.repository.ts` | Replace join table subquery |
| 17 | `src/modules/quiz/dto/response/quiz-list-item.dto.ts` | Add `categoryId` field |
| 18 | `src/modules/quiz/dto/response/quiz-response.dto.ts` | Replace `categoryIds` array with `categoryId` |
| 19 | `src/modules/quiz/mappers/quiz-response.mapper.ts` | Map single `categoryId` |
| 20 | `src/commands/seed/development/quiz.seed.ts` | Replace insert into join table with UPDATE |
| 21 | `SEED_RECORD.md` | Regenerate via `pnpm db:seed:all` |
