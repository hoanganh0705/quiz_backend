# Quiz Module API Contract Audit Report

**Date:** July 15, 2026  
**Auditor:** Senior Backend API Review  
**Module:** Quiz Module  
**Total Endpoints Audited:** 22

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Contract Health Score** | 7.5/10 |
| **Total Issues Found** | 15 |
| Critical | 1 |
| High | 4 |
| Medium | 6 |
| Low | 5 |

---

## Endpoint Inventory

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | POST | `/quizzes` | Required | Create quiz |
| 2 | GET | `/quizzes` | Public | List quizzes (cursor paginated) |
| 3 | GET | `/quizzes/me` | Required | List user's quizzes |
| 4 | GET | `/quizzes/me/drafts` | Required | List user's draft quizzes |
| 5 | GET | `/quizzes/me/published` | Required | List user's published quizzes |
| 6 | GET | `/quizzes/me/analytics` | Required | Get creator analytics |
| 7 | GET | `/quizzes/trending` | Public | Get trending quizzes |
| 8 | GET | `/quizzes/popular` | Public | Get popular quizzes |
| 9 | GET | `/quizzes/featured` | Public | Get featured quizzes |
| 10 | GET | `/quizzes/:id` | Public | Get quiz by ID/slug |
| 11 | GET | `/quizzes/:id/stats` | Public | Get quiz stats |
| 12 | GET | `/quizzes/:slug/similar` | Public | Get related/similar quizzes |
| 13 | PATCH | `/quizzes/:id` | Required | Update quiz |
| 14 | DELETE | `/quizzes/:id` | Required | Delete quiz (soft delete) |
| 15 | POST | `/quizzes/:id/versions` | Required | Create quiz version |
| 16 | GET | `/quizzes/:id/versions` | Required | List quiz versions |
| 17 | GET | `/quizzes/:id/versions/:versionId` | Required | Get version detail |
| 18 | PATCH | `/quizzes/:id/versions/:versionId` | Required | Update version |
| 19 | POST | `/quizzes/:id/versions/:versionId/publish` | Required | Publish version |
| 20 | POST | `/quizzes/:id/versions/:versionId/questions` | Required | Create question |
| 21 | POST | `/quizzes/:id/versions/:versionId/questions/bulk` | Required | Bulk create questions |

---

## Issues by Severity

### Critical Issues

#### ISSUE-001: Duplicate `CreateQuizQuestionsDto` Class Definition

| Attribute | Value |
|-----------|-------|
| **Severity** | Critical |
| **Type** | Implementation Bug |
| **Files Affected** | `src/modules/quiz/dto/request/create-quiz-question.dto.ts` (lines 89-102), `src/modules/quiz/dto/request/create-quiz-questions.dto.ts` (entire file) |

**Current Behavior:**
The class `CreateQuizQuestionsDto` is defined twice in two different files:
1. `create-quiz-question.dto.ts` (lines 89-102)
2. `create-quiz-questions.dto.ts` (entire file)

**Root Cause:**
Accidental duplication during development. The second definition in `create-quiz-questions.dto.ts` overwrites the first when modules are loaded.

**Implementation Correct?** Implementation is incorrect.

**Documentation Correct?** N/A (this is a code issue).

**Recommendation:**
Keep the file `create-quiz-questions.dto.ts` and remove the duplicate class definition from `create-quiz-question.dto.ts`.

**Suggested Fix:**
Remove lines 89-102 from `create-quiz-question.dto.ts`, keeping only the import statement:
```typescript
import { CreateQuizQuestionsDto } from './create-quiz-questions.dto';
```

---

### High Issues

#### ISSUE-002: Inconsistent UUID Validation Across DTOs

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Type** | Validation Inconsistency |
| **Files Affected** | `create-quiz.dto.ts`, `update-quiz.dto.ts`, `create-quiz-version.dto.ts` |

**Current Behavior:**
- `CreateQuizDto.categoryId`: `@IsUUID('all')` - accepts any UUID version
- `UpdateQuizDto.categoryId`: `@IsUUID('4')` - only accepts UUIDv4
- `CreateQuizVersionDto.sourceVersionId`: `@IsUUID()` - accepts any UUID version

**Root Cause:**
Different developers used different UUID validation strategies.

**Implementation Correct?** Documentation is correct, implementation varies.

**Documentation Correct?** Inconsistent.

**Recommendation:**
Standardize to `@IsUUID('4')` across all UUID fields (UUIDv4 is the standard for externally-facing IDs).

**Suggested Fix:**
Update `create-quiz.dto.ts` line 156 and `create-quiz-version.dto.ts` line 14 to use `@IsUUID('4')`.

---

#### ISSUE-003: Missing Default `limit` Value in `ListQuizVersionsQueryDto`

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Type** | Documentation/Implementation Mismatch |
| **Files Affected** | `list-quiz-versions-query.dto.ts` |

**Current Behavior:**
`ListQuizVersionsQueryDto` has no default value for `limit`:
```typescript
limit?: number;  // No default
```

However, the application service (`quiz-version.application.service.ts` line 45) defaults to 10:
```typescript
limit: dto.limit ?? 10,
```

**Root Cause:**
Inconsistency between DTO and application service default values.

**Implementation Correct?** Implementation is correct (uses 10).

**Documentation Correct?** No default documented.

**Recommendation:**
Add a default value to `ListQuizVersionsQueryDto.limit`.

**Suggested Fix:**
```typescript
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(100)
limit?: number = 10;
```

---

#### ISSUE-004: Missing `@ApiBadRequestResponse` for Featured/Trending/Popular Endpoints

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Type** | Documentation Gap |
| **Files Affected** | `quiz.controller.ts` |

**Current Behavior:**
The following endpoints lack `@ApiBadRequestResponse` decorators:
- `GET /quizzes/featured` (line 295-303)
- `GET /quizzes/trending` (line 235-258)
- `GET /quizzes/popular` (line 260-283)

**Root Cause:**
Inconsistent decorator application across similar endpoints.

**Implementation Correct?** Implementation handles validation.

**Documentation Correct?** Documentation is incomplete.

**Recommendation:**
Add `@ApiBadRequestResponse` decorators to all three endpoints for consistency.

---

#### ISSUE-005: `GET /quizzes/:slug/similar` Uses Wrong Parameter Name

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Type** | Implementation vs Documentation Mismatch |
| **Files Affected** | `quiz.controller.ts` (line 344-367) |

**Current Behavior:**
The endpoint is defined as `@Get(':slug/similar')` with parameter `@Param('slug')`.

**Expected Behavior:**
The path parameter should be `:id` to match other endpoints that accept both UUID and slug (like `GET /quizzes/:id`).

**Implementation Correct?** Inconsistent with other endpoints.

**Documentation Correct?** Matches implementation (but implementation is inconsistent).

**Recommendation:**
Consider renaming to `:id` for consistency, or update documentation to clarify this endpoint only accepts slugs (not UUIDs).

---

### Medium Issues

#### ISSUE-006: Missing Request Body Examples in Swagger Documentation

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Type** | Documentation Gap |
| **Files Affected** | All POST/PATCH endpoints |

**Current Behavior:**
POST/PATCH endpoints use `@ApiCreatedResource` and `@ApiOkResource` without explicit `example` or `examples` options for request bodies.

**Root Cause:**
The API decorators were defined without request body examples.

**Recommendation:**
Add example request bodies to all create/update DTOs with `@ApiProperty({ example: ... })` annotations.

---

#### ISSUE-007: `QuizVersionDetailResponseDto` Field Name Mismatch

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Type** | Response Schema Inconsistency |
| **Files Affected** | `quiz-version-response.dto.ts`, `quiz-version-response.mapper.ts` |

**Current Behavior:**
- `QuizVersionDetailResponseDto` uses `versionId` (line 10)
- `QuizVersionResponseDto` uses `quizVersionId` (line 69)

**Root Cause:**
The detail response was created with a different naming convention than the list response.

**Recommendation:**
Rename `versionId` to `quizVersionId` in `QuizVersionDetailResponseDto` for consistency.

---

#### ISSUE-008: Inconsistent Pagination Wrapper for Non-Paginated List Endpoints

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Type** | Response Schema Inconsistency |
| **Files Affected** | `quiz.presenter.ts` (lines 76-78), `quiz-analytics.dto.ts` |

**Current Behavior:**
The presenter methods for `getFeaturedQuizzes`, `getRelatedQuizzes`, and `getSimilarQuizzes` return:
```typescript
{ data: QuizListItemDto[], meta: { timestamp } }
```

While `TrendingQuizzesResponseDto` and `PopularQuizzesResponseDto` include:
```typescript
{ period: 'daily'|'weekly', quizzes: [...], lastUpdated: string }
```

**Recommendation:**
Standardize list response wrappers or document the different response shapes clearly.

---

#### ISSUE-009: Missing `creatorId` in Response DTOs for Analytics

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Type** | Documentation Gap |
| **Files Affected** | `quiz-analytics.dto.ts` |

**Current Behavior:**
`CreatorQuizAnalyticsDto` returns `userId` but `TrendingQuizItemDto` and `PopularQuizItemDto` don't include `creatorId`.

**Recommendation:**
Consider adding `creatorId` to `TrendingQuizItemDto` and `PopularQuizItemDto`.

---

#### ISSUE-010: `getQuizStats` Missing `@ApiNotFoundResponse`

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Type** | Documentation Gap |
| **Files Affected** | `quiz.controller.ts` (lines 324-342) |

**Current Behavior:**
The `getQuizStats` endpoint has error handling for not found but the decorator is missing.

**Recommendation:**
Add `@ApiNotFoundResponse({ example: quizStatsNotFoundExample })` to the `getQuizStats` endpoint.

---

#### ISSUE-011: Inconsistent Error Response Examples

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Type** | Documentation Gap |
| **Files Affected** | `errors.examples.ts` |

**Current Behavior:**
Some error examples have custom `detail` messages while others use generic messages from `ErrorResponseExamples`.

**Recommendation:**
Ensure all error examples have consistent structure and meaningful detail messages specific to each endpoint.

---

### Low Issues

#### ISSUE-012: `categoryId` Validation Allows Empty String in `UpdateQuizDto`

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Type** | Validation Edge Case |
| **Files Affected** | `update-quiz.dto.ts` |

**Recommendation:**
Add `@IsOptional()` decorator to explicitly handle the nullable case.

---

#### ISSUE-013: Missing `creatorId` Filter in Public Quiz Listing

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Type** | Feature Gap |
| **Files Affected** | `list-quizzes-query.dto.ts` |

**Recommendation:**
Document this as an intentional privacy decision or add the filter if creator visibility is desired.

---

#### ISSUE-014: `slug` Field Accepts Invalid Slugs in Edge Cases

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Type** | Validation Edge Case |
| **Files Affected** | `create-quiz.dto.ts`, `update-quiz.dto.ts` |

**Recommendation:**
Add additional validation or document the exact slug rules.

---

#### ISSUE-015: No Rate Limiting Documentation

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Type** | Documentation Gap |
| **Files Affected** | All endpoints |

**Recommendation:**
Add rate limiting documentation if implemented.

---

## Migration Plan

### Phase 1: Critical Implementation Fixes

**Goal:** Fix critical bugs that can cause runtime errors.

| Issue | Fix | Effort | Risk |
|-------|-----|--------|------|
| ISSUE-001 | Remove duplicate `CreateQuizQuestionsDto` class | Low | Low |

**Issues Included:** ISSUE-001

**Reason These Issues Belong Together:** Both are critical bugs that can cause runtime errors or unexpected behavior.

**Dependencies:** None

**Estimated Implementation Complexity:** Low

**Estimated Implementation Risk:** Low

**Backward Compatible:** Yes

**Generated SDKs Affected:** No

**Database Migrations Required:** No

**Tests to Update:** No new tests needed, existing tests should still pass.

---

### Phase 2: Validation & Authorization Consistency

**Goal:** Ensure consistent validation rules across all DTOs.

| Issue | Fix | Effort | Risk |
|-------|-----|--------|------|
| ISSUE-002 | Standardize UUID validation to `@IsUUID('4')` | Low | Low |
| ISSUE-003 | Add default `limit` to `ListQuizVersionsQueryDto` | Low | Low |

**Issues Included:** ISSUE-002, ISSUE-003

**Reason These Issues Belong Together:** Both address validation inconsistencies that could lead to unexpected behavior.

**Dependencies:** None

**Estimated Implementation Complexity:** Low

**Estimated Implementation Risk:** Low

**Backward Compatible:** Yes (validation tightening)

**Generated SDKs Affected:** No

**Database Migrations Required:** No

**Tests to Update:** May need to update tests expecting different UUID versions.

---

### Phase 3: OpenAPI Documentation Completeness

**Goal:** Complete missing API documentation decorators.

| Issue | Fix | Effort | Risk |
|-------|-----|--------|------|
| ISSUE-004 | Add missing `@ApiBadRequestResponse` decorators | Medium | Low |
| ISSUE-010 | Add missing `@ApiNotFoundResponse` decorator | Low | Low |

**Issues Included:** ISSUE-004, ISSUE-010

**Reason These Issues Belong Together:** Both are missing API response documentation.

**Dependencies:** None

**Estimated Implementation Complexity:** Medium

**Estimated Implementation Risk:** Low

**Backward Compatible:** Yes (documentation only)

**Generated SDKs Affected:** Yes (SDK generation will include new response types)

**Database Migrations Required:** No

**Tests to Update:** No

---

### Phase 4: Response Schema Consistency

**Goal:** Standardize response schemas across similar endpoints.

| Issue | Fix | Effort | Risk |
|-------|-----|--------|------|
| ISSUE-007 | Rename `versionId` to `quizVersionId` | Medium | Medium |
| ISSUE-008 | Standardize list response wrappers | High | Medium |
| ISSUE-009 | Add `creatorId` to analytics DTOs | Low | Low |

**Issues Included:** ISSUE-007, ISSUE-008, ISSUE-009

**Reason These Issues Belong Together:** All address response schema inconsistencies.

**Dependencies:** Phase 3

**Estimated Implementation Complexity:** Medium to High

**Estimated Implementation Risk:** Medium

**Backward Compatible:** No (breaking change)

**Generated SDKs Affected:** Yes

**Migration Strategy:**
1. Deploy with both old and new field names (deprecation period)
2. Monitor client usage
3. Remove old field names after deprecation period

---

### Phase 5: Swagger Examples & Error Responses

**Goal:** Improve developer experience with comprehensive examples.

| Issue | Fix | Effort | Risk |
|-------|-----|--------|------|
| ISSUE-006 | Add request body examples to DTOs | Medium | Low |
| ISSUE-011 | Standardize error example format | Medium | Low |

**Issues Included:** ISSUE-006, ISSUE-011

**Reason These Issues Belong Together:** Both improve API documentation quality.

**Dependencies:** Phase 3

**Estimated Implementation Complexity:** Medium

**Estimated Implementation Risk:** Low

**Backward Compatible:** Yes (documentation only)

**Generated SDKs Affected:** Yes (SDK generation will include examples)

---

### Phase 6: Edge Case Handling & Clarifications

**Goal:** Address edge cases and clarify behavior.

| Issue | Fix | Effort | Risk |
|-------|-----|--------|------|
| ISSUE-005 | Clarify `/quizzes/:slug/similar` parameter | Low | Low |
| ISSUE-012 | Improve `categoryId` validation | Low | Low |
| ISSUE-013 | Document `creatorId` filter decision | Low | Low |
| ISSUE-014 | Document slug validation rules | Low | Low |
| ISSUE-015 | Document rate limiting | Low | Low |

**Issues Included:** ISSUE-005, ISSUE-012, ISSUE-013, ISSUE-014, ISSUE-015

**Reason These Issues Belong Together:** All are low-priority clarifications.

**Dependencies:** Phase 4

**Estimated Implementation Complexity:** Low

**Estimated Implementation Risk:** Low

**Backward Compatible:** Yes

---

## Implementation Order Summary

| Phase | Name | Issues | Estimated Time |
|-------|------|--------|---------------|
| 1 | Critical Implementation Fixes | ISSUE-001 | 1-2 hours |
| 2 | Validation & Authorization Consistency | ISSUE-002, ISSUE-003 | 2-3 hours |
| 3 | OpenAPI Documentation Completeness | ISSUE-004, ISSUE-010 | 4-6 hours |
| 4 | Response Schema Consistency | ISSUE-007, ISSUE-008, ISSUE-009 | 6-8 hours |
| 5 | Swagger Examples & Error Responses | ISSUE-006, ISSUE-011 | 4-5 hours |
| 6 | Edge Case Handling & Clarifications | ISSUE-005, ISSUE-012, ISSUE-013, ISSUE-014, ISSUE-015 | 2-3 hours |

**Total Estimated Time:** 19-27 hours

---

## Issue Classification Summary

| Classification | Count | Issues |
|---------------|-------|--------|
| **Critical Implementation Bug** | 1 | ISSUE-001 |
| **High Validation Inconsistency** | 4 | ISSUE-002, ISSUE-003, ISSUE-004, ISSUE-005 |
| **Medium Documentation Gap** | 6 | ISSUE-006, ISSUE-007, ISSUE-008, ISSUE-009, ISSUE-010, ISSUE-011 |
| **Low Enhancement** | 5 | ISSUE-012, ISSUE-013, ISSUE-014, ISSUE-015, ISSUE-016 |

---

## Breaking Changes

The following phases introduce breaking changes and require careful migration:

### Phase 4: Response Schema Consistency

- **ISSUE-007:** Renaming `versionId` to `quizVersionId` in `QuizVersionDetailResponseDto`
- **ISSUE-008:** Standardizing list response wrappers

**Migration Strategy:**
1. Add new fields alongside old fields
2. Mark old fields as deprecated
3. Monitor usage
4. Remove old fields after deprecation period (recommended: 2 sprints)

---

## Testing Recommendations

| Phase | Tests to Add |
|-------|-------------|
| Phase 1 | Unit tests for DTO imports |
| Phase 2 | UUID validation edge case tests |
| Phase 3 | API documentation contract tests |
| Phase 4 | Response schema validation tests |
| Phase 5 | Example generation tests |
| Phase 6 | Edge case tests |

---

## Rollout Checklist

- [ ] Review all changes with frontend team
- [ ] Update generated SDKs after Phase 3
- [ ] Communicate breaking changes after Phase 4
- [ ] Update API documentation portal
- [ ] Add monitoring for deprecated field usage
- [ ] Set deprecation period end date
