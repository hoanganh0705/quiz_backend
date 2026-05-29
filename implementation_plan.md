# Quiz Module — Final Staff-Level Architecture Refinement

## Summary

The codebase is already in strong shape from the previous refactor pass. This plan pushes the final 10% from "good senior" toward "staff-level maintainable architecture." Each goal below is calibrated to add **genuine architectural value without ceremony or over-engineering**.

---

## Audit Findings

### What Already Exists (GOOD — No Change Needed)

| Area | Status |
|------|--------|
| Projection constants in all 3 repositories | ✅ Done last session |
| Cursor codec extracted | ✅ In `shared/cursor/` |
| Version state machine | ✅ `quiz-version-state-machine.ts` |
| Domain error taxonomy | ✅ Full, well-typed |
| Exception filter | ✅ Catches all `QuizDomainError` subclasses |
| Repository ports | ✅ Symbol-based DI, interface-typed |
| `quiz-utils.ts` | ✅ Only 2 functions now (slug + link IDs) |
| `common/utils/cursor.util.ts` | ✅ Already exists in `common/` |
| `quiz-authorization.helper.ts` | ✅ Pure functions, well-structured |

### Key Finding: `quiz-utils.ts` is NOT a junk drawer
After the previous refactor it contains exactly **2 functions**: `normalizeLinkIds` and `normalizeQuizSlug`. This is already appropriately small. Goal 1 is a targeted re-evaluation.

### Key Finding: Generic cursor codec ALREADY has a common counterpart
`src/common/utils/cursor.util.ts` **already exists** with `decodeBase64JsonCursor` / `encodeBase64JsonCursor`. The quiz-specific `shared/cursor/cursor-codec.ts` adds quiz-domain validation (`QuizValidationError`). These are **correctly separated**: shared transport layer vs. domain-validated codec. Goal 2 needs re-scoping.

### What Still Has Genuine Improvement Potential

| # | Issue | Real Value |
|---|-------|-----------|
| 1 | `quiz-utils.ts` slug + link IDs could be co-located closer to where they're used | Low — already small |
| 2 | Cursor codec: quiz module imports domain types into `shared/`; direction could be inverted | Medium |
| 3 | All 3 response mappers are `@Injectable()` with zero dependencies — pure DI anti-pattern | **High** |
| 4 | `QuizReadService` / `QuizWriteService` names are accurate but not intent-communicating | Medium |
| 5 | Aggregate boundaries are implicit — missing documentation of consistency boundaries | Medium |
| 6 | No domain events — lifecycle transitions emit nothing | **High** for extensibility |
| 7 | Policy logic is split between `authz/`, `domain/version/state-machine`, and services | **High** |
| 8 | Transaction boundaries are implicit in repository method names | Low — already well-named |
| 9 | No additional projection duplication found | ✅ Already done |

---

## User Review Required

> [!IMPORTANT]
> **Goal 3 (mapper conversion) removes mappers from the DI graph.** Services currently inject `QuizResponseMapper`, `QuizVersionResponseMapper`, `QuizQuestionResponseMapper`. After conversion to static classes, these will be called directly as `QuizResponseMapper.toQuizResponse(row)`. The `quiz.module.ts` provider list shrinks by 3 entries. No runtime behavior changes.

> [!WARNING]
> **Goal 6 (domain events) introduces a new pattern.** The events are purely in-process `EventEmitter2` events (NestJS built-in). They do NOT add external dependencies. However, they do require adding `EventEmitterModule.forRoot()` to the app module IF it isn't already registered. I'll check before adding.

> [!NOTE]
> **Goal 4 (service renaming) is a refactor-in-place.** `quiz-read.service.ts` → `quiz-query.service.ts`, `quiz-write.service.ts` → `quiz-command.service.ts`. All imports will be updated. TypeScript compilation verifies completeness. Old file names are deleted.

> [!NOTE]
> **Goal 1 re-scoped:** `quiz-utils.ts` is already small (2 functions). The real smell is that `normalizeQuizSlug` belongs in `domain/slug/` as a domain concept, while `normalizeLinkIds` belongs in `domain/links/`. This is a cohesion improvement at the **domain layer**, not a utility extraction.

> [!NOTE]
> **Goal 2 re-scoped:** The quiz-specific cursor codec correctly lives inside the quiz module because it throws `QuizValidationError` (a domain error). Moving it to `common/cursor/` would create a dependency from `common` → `quiz domain`, which is an **inversion violation**. The correct fix is to use the already-existing `common/utils/cursor.util.ts` primitives as the base and keep quiz-domain validation in the quiz module. We can update `cursor-codec.ts` to delegate base64 ops to `common/utils/cursor.util.ts`.

---

## Open Questions

> [!IMPORTANT]
> **Goal 6 (events): Is EventEmitterModule already registered in the app module?** If yes, we proceed immediately. If not, should we add it or use a simpler domain event bus pattern (plain observer/callback)?

---

## Proposed Changes

### Goal 1 — Domain Utility Cohesion (quiz-utils.ts split)

Re-scope: Move `normalizeQuizSlug` to `domain/slug/quiz-slug.ts` and `normalizeLinkIds` to `domain/links/quiz-link-ids.ts`. Delete `domain/shared/quiz-utils.ts`.

---

#### [NEW] domain/slug/quiz-slug.ts
```ts
// normalizeQuizSlug(slug: string): string — throws QuizValidationError
```

#### [NEW] domain/links/quiz-link-ids.ts
```ts
// normalizeLinkIds(values?: string[]): string[]
```

#### [DELETE] domain/shared/quiz-utils.ts

#### [MODIFY] domain/quiz/quiz-write.service.ts
- Update import paths

#### [MODIFY] domain/quiz/quiz-read.service.ts (→ quiz-query.service.ts, see Goal 4)
- Update import paths

---

### Goal 2 — Cursor Codec: Use Common Primitives

Update `shared/cursor/cursor-codec.ts` to delegate base64/JSON operations to `common/utils/cursor.util.ts` instead of using raw `btoa`/`atob`. The quiz-domain validation layer stays in the quiz module.

---

#### [MODIFY] shared/cursor/cursor-codec.ts
- Replace `btoa(JSON.stringify(...))` with `encodeBase64JsonCursor({...})`
- Replace `JSON.parse(atob(raw))` with `decodeBase64JsonCursor<T>(raw)` 
- Keep `QuizValidationError` throw for typed validation

---

### Goal 3 — Convert Pure Mappers to Static Utility Classes

All 3 injectable mappers have **zero constructor dependencies**. Converting to static classes removes them from the NestJS DI graph entirely.

---

#### [MODIFY] mappers/quiz-response.mapper.ts
- Remove `@Injectable()`
- Convert `toQuizResponse()` to `static`

#### [MODIFY] mappers/quiz-version-response.mapper.ts
- Remove `@Injectable()`
- Convert `toQuizVersionResponse()` to `static`

#### [MODIFY] mappers/quiz-question-response.mapper.ts
- Remove `@Injectable()`
- Convert `toQuestionResponses()` + `toQuestionResponse()` to `static`

#### [MODIFY] application/quiz.application.service.ts
- Remove `quizResponseMapper` and `quizQuestionResponseMapper` constructor injections
- Replace `this.quizResponseMapper.toQuizResponse(...)` with `QuizResponseMapper.toQuizResponse(...)`

#### [MODIFY] application/quiz-version.application.service.ts
- Remove `quizVersionResponseMapper` injection
- Replace instance calls with static calls

#### [MODIFY] application/quiz-question.application.service.ts
- Remove `quizQuestionResponseMapper` injection
- Replace instance calls with static calls

#### [MODIFY] quiz.module.ts
- Remove `QuizResponseMapper`, `QuizVersionResponseMapper`, `QuizQuestionResponseMapper` from providers

---

### Goal 4 — Intent-Communicating Service Names

`QuizReadService` → `QuizQueryService` (query orchestration: load, list, lookup)
`QuizWriteService` → `QuizCommandService` (command orchestration: create, update, delete)

---

#### [RENAME] domain/quiz/quiz-read.service.ts → domain/quiz/quiz-query.service.ts
- Class: `QuizReadService` → `QuizQueryService`

#### [RENAME] domain/quiz/quiz-write.service.ts → domain/quiz/quiz-command.service.ts
- Class: `QuizWriteService` → `QuizCommandService`

#### [MODIFY] All files that import `QuizReadService` or `QuizWriteService`:
- `application/quiz.application.service.ts`
- `domain/version/quiz-version.service.ts`
- `quiz.module.ts`

---

### Goal 5 — Lightweight Aggregate Boundary Documentation

Introduce a `domain/aggregates/` directory with JSDoc-annotated boundary files. These are **documentation artifacts**, not executable abstractions. They make invariant ownership and consistency boundaries explicit for future contributors.

---

#### [NEW] domain/aggregates/quiz.aggregate.ts
```ts
/**
 * QuizAggregate — Consistency Boundary
 * Root: Quiz (quizId)
 * Invariants:
 *   - slug must be unique across all non-deleted quizzes
 *   - publishedVersionId points to exactly one QuizVersion with status='published'
 *   - soft-delete cascades to all associated versions (query-level filter)
 * Transactional scope: createQuizWithInitialVersion (quiz + version + links in one TX)
 * Repository: QuizRepositoryPort
 */
```

#### [NEW] domain/aggregates/quiz-version.aggregate.ts
```ts
/**
 * QuizVersionAggregate — Consistency Boundary
 * Root: QuizVersion (quizVersionId)
 * Invariants:
 *   - Only one version per quiz may have status='published' at a time
 *   - Publishing atomically archives the previous published version
 *   - Only 'draft' versions are mutable
 *   - A draft version requires MIN_QUESTIONS_TO_PUBLISH questions before publishing
 * Transactional scope: publishQuizVersionAndSetQuiz (archive old + publish new + update quiz FK)
 * Repository: QuizVersionRepositoryPort
 */
```

#### [NEW] domain/aggregates/quiz-question.aggregate.ts
```ts
/**
 * QuizQuestionAggregate — Consistency Boundary
 * Root: QuizQuestion (questionId)
 * Invariants:
 *   - Position must be unique within a quiz version
 *   - Each question must have exactly one correct answer option
 *   - Answer option position must be unique within a question
 * Transactional scope: createQuestionWithOptions (question + options in one TX)
 * Repository: QuizQuestionRepositoryPort
 */
```

---

### Goal 6 — Domain Events for Major Lifecycle Transitions

Introduce lightweight, framework-minimal domain event types and emit them after successful transitions in the domain services. Uses NestJS `EventEmitter2` (already available in NestJS ecosystem as `@nestjs/event-emitter`).

---

#### [NEW] domain/events/quiz-domain.events.ts
```ts
export class QuizCreatedEvent { constructor(public readonly quizId: string, public readonly creatorId: string, public readonly slug: string, public readonly nowIso: string) {} }
export class QuizUpdatedEvent { constructor(public readonly quizId: string, public readonly updatedByUserId: string, public readonly nowIso: string) {} }
export class QuizDeletedEvent { constructor(public readonly quizId: string, public readonly deletedByUserId: string, public readonly nowIso: string) {} }
export class QuizVersionPublishedEvent { constructor(public readonly quizVersionId: string, public readonly quizId: string, public readonly publishedByUserId: string, public readonly versionNumber: number, public readonly nowIso: string) {} }
export class QuizVersionCreatedEvent { constructor(public readonly quizVersionId: string, public readonly quizId: string, public readonly createdByUserId: string, public readonly versionNumber: number, public readonly nowIso: string) {} }
```

#### [MODIFY] domain/quiz/quiz-command.service.ts (was write.service.ts)
- Inject `EventEmitter2`
- Emit `QuizCreatedEvent` after `createQuiz`
- Emit `QuizUpdatedEvent` after `updateQuiz`
- Emit `QuizDeletedEvent` after `softDeleteQuizById`

#### [MODIFY] domain/version/quiz-version.service.ts
- Inject `EventEmitter2`
- Emit `QuizVersionCreatedEvent` after `createQuizVersion`
- Emit `QuizVersionPublishedEvent` after `publishQuizVersion`

#### [MODIFY] quiz.module.ts
- Check/add `EventEmitterModule` registration (conditional on whether it's in AppModule)

---

### Goal 7 — Extract Policy Objects

Extract authorization/business-rule decisions into explicit `QuizPolicy` and `QuizVersionPolicy` classes. These are **pure objects** (no DI needed, no state), replacing scattered `canManageOwnOrAny` + `hasPermission` calls.

---

#### [NEW] domain/policies/quiz.policy.ts
```ts
// QuizPolicy.assertCanEdit(quiz, user): void
// QuizPolicy.assertCanDelete(quiz, user): void
// QuizPolicy.assertCanCreate(user): void
// QuizPolicy.isOwner(quiz, user): boolean
```

#### [NEW] domain/policies/quiz-version.policy.ts
```ts
// QuizVersionPolicy.assertCanCreate(quiz, user): void
// QuizVersionPolicy.assertCanView(quiz, user): void
// QuizVersionPolicy.assertCanEdit(version, user): EditTransitionResult
// QuizVersionPolicy.assertCanPublish(version, quiz, user): void
```

#### [MODIFY] domain/quiz/quiz-command.service.ts
- Replace `this.assertQuizOwnerOrAdmin(...)` with `QuizPolicy.assertCanEdit(quiz, user)`

#### [MODIFY] domain/version/quiz-version.service.ts
- Replace `assertQuizManagePermission` + `canManageOwnOrAny` calls with `QuizVersionPolicy.*`

#### [MODIFY] domain/question/quiz-question.service.ts
- Replace `assertCanCreateQuestions` internals with `QuizVersionPolicy.assertCanEdit(...)`

---

### Goal 8 — Document Transaction Boundaries (Inline)

Add explicit `@transactional` JSDoc comments to repository port interface methods and domain service methods that participate in multi-step atomic operations. **No code change — documentation only.**

---

#### [MODIFY] domain/ports/quiz-repository.port.ts
- Add `@transactional` JSDoc to `createQuizWithInitialVersion`

#### [MODIFY] domain/ports/quiz-version-repository.port.ts
- Add `@transactional` JSDoc to `publishQuizVersionAndSetQuiz`, `createDraftFromSourceVersion`

#### [MODIFY] domain/ports/quiz-question-repository.port.ts
- Add `@transactional` JSDoc to `createQuestionWithOptions`, `createQuestionsWithOptions`

---

### Goal 9 — No Additional Projection Deduplication Needed

✅ Already completed in previous session. No further action required.

---

## Execution Order

```
1. Goal 1: Split quiz-utils.ts into slug/ and links/ directories
2. Goal 2: Update cursor-codec.ts to use common primitives
3. Goal 3: Convert 3 mappers to static classes; update 3 app services + module
4. Goal 4: Rename read/write services; update all imports
5. Goal 7: Extract QuizPolicy + QuizVersionPolicy; update 3 domain services
6. Goal 6: Add domain events; update 2 domain services; update module
7. Goal 5: Add aggregate boundary documentation files
8. Goal 8: Add @transactional JSDoc to repository ports
```

---

## Risk Assessment

| Goal | Risk | Rationale |
|------|------|-----------|
| 1 — utility split | Low | Only 2 imports change |
| 2 — cursor codec | Very Low | Pure delegation change |
| 3 — static mappers | Low | No runtime behavior change |
| 4 — service rename | Medium | All 5+ import sites must be updated |
| 5 — aggregate docs | None | Documentation only |
| 6 — domain events | Low | Additive; services still work without listeners |
| 7 — policy extraction | Medium | Service methods refactored; logic preserved |
| 8 — TX docs | None | Documentation only |

---

## Verification Plan

### TypeScript Compilation
```bash
npx tsc --noEmit
```
Expected: 0 quiz-module errors (same 3 pre-existing user module errors).

### Behavior Invariants
All existing API routes, permissions, DB contracts, and error responses remain unchanged. No migrations, no schema changes, no response DTO changes.
