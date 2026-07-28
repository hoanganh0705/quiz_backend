import { HttpStatus } from '@nestjs/common';
import { ProblemCodeMapping, resolveProblemInfo } from '@/common/errors/problem-code-mapping';

describe('ProblemCodeMapping', () => {
  describe('uniqueness', () => {
    it('declares unique keys', () => {
      const keys = Object.keys(ProblemCodeMapping);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  });

  describe('resolveProblemInfo (known code)', () => {
    it('returns the matching entry for AUTH_INVALID_CREDENTIALS', () => {
      const info = resolveProblemInfo('AUTH_INVALID_CREDENTIALS');
      expect(info.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(info.title).toBe('Unauthorized');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/auth-invalid-credentials');
    });

    it('returns a 409 entry for AUTH_DELETION_FAILED', () => {
      const info = resolveProblemInfo('AUTH_DELETION_FAILED');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 429 entry for AUTH_RATE_LIMITED', () => {
      const info = resolveProblemInfo('AUTH_RATE_LIMITED');
      expect(info.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(info.title).toBe('TooManyRequests');
    });
  });

  describe('resolveProblemInfo (quiz module)', () => {
    it('returns a 404 entry for QUIZ_NOT_FOUND', () => {
      const info = resolveProblemInfo('QUIZ_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/quiz-not-found');
    });

    it('returns a 403 entry for QUIZ_FORBIDDEN', () => {
      const info = resolveProblemInfo('QUIZ_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 422 entry for QUIZ_INSUFFICIENT_QUESTIONS', () => {
      const info = resolveProblemInfo('QUIZ_INSUFFICIENT_QUESTIONS');
      expect(info.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(info.title).toBe('UnprocessableEntity');
    });

    it('returns a 500 entry for QUIZ_OPERATION_FAILED (unmapped-DB catch-all)', () => {
      const info = resolveProblemInfo('QUIZ_OPERATION_FAILED');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });

    it('returns a 404 entry for QUIZ_ANALYTICS_NOT_FOUND (improved behavior vs. plain Error 500)', () => {
      const info = resolveProblemInfo('QUIZ_ANALYTICS_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 500 entry for QUIZ_ANALYTICS_CALCULATION_FAILED', () => {
      const info = resolveProblemInfo('QUIZ_ANALYTICS_CALCULATION_FAILED');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });
  });

  describe('resolveProblemInfo (attempt module)', () => {
    it('returns a 404 entry for ATTEMPT_NOT_FOUND', () => {
      const info = resolveProblemInfo('ATTEMPT_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/attempt-not-found');
    });

    it('returns a 403 entry for ATTEMPT_FORBIDDEN', () => {
      const info = resolveProblemInfo('ATTEMPT_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 400 entry for ATTEMPT_VALIDATION_FAILED (standalone class, no children)', () => {
      const info = resolveProblemInfo('ATTEMPT_VALIDATION_FAILED');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 409 entry for ATTEMPT_ALREADY_STARTED', () => {
      const info = resolveProblemInfo('ATTEMPT_ALREADY_STARTED');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for ATTEMPT_NOT_ACTIVE', () => {
      const info = resolveProblemInfo('ATTEMPT_NOT_ACTIVE');
      expect(info.status).toBe(HttpStatus.CONFLICT);
    });

    it('returns a 422 entry for ATTEMPT_QUIZ_NOT_PUBLISHED', () => {
      const info = resolveProblemInfo('ATTEMPT_QUIZ_NOT_PUBLISHED');
      expect(info.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(info.title).toBe('UnprocessableEntity');
    });

    it('returns a 422 entry for ATTEMPT_QUESTION_INVALID', () => {
      const info = resolveProblemInfo('ATTEMPT_QUESTION_INVALID');
      expect(info.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('returns a 422 entry for ATTEMPT_NOT_COMPLETED', () => {
      const info = resolveProblemInfo('ATTEMPT_NOT_COMPLETED');
      expect(info.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('returns a 404 entry for ATTEMPT_ANSWER_NOT_FOUND (dead-code class with sensible mapping)', () => {
      const info = resolveProblemInfo('ATTEMPT_ANSWER_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });
  });

  describe('resolveProblemInfo (user module)', () => {
    it('returns a 404 entry for USER_NOT_FOUND', () => {
      const info = resolveProblemInfo('USER_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/user-not-found');
    });

    it('returns the 500 fallback for USER_RANKING_NOT_FOUND — Phase 7 (F-18) removed the mapping', () => {
      // The `UserRankingNotFoundError` class was exported and mapped but
      // never thrown; per F-18 the mapping was deleted as dead code.
      // The resolver falls back to the "unknown code" path, which the
      // global filter turns into a 500. This test pins that contract.
      const info = resolveProblemInfo('USER_RANKING_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });

    it('returns a 404 entry for USER_ANALYTICS_NOT_FOUND (dead-code class with sensible mapping)', () => {
      const info = resolveProblemInfo('USER_ANALYTICS_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 403 entry for USER_PROFILE_PRIVATE', () => {
      const info = resolveProblemInfo('USER_PROFILE_PRIVATE');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/user-profile-private');
    });
  });

  describe('resolveProblemInfo (category module — Phase 2)', () => {
    it('returns a 404 entry for CATEGORY_NOT_FOUND', () => {
      const info = resolveProblemInfo('CATEGORY_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/category-not-found');
    });

    it('returns a 404 entry for CATEGORY_ANALYTICS_NOT_FOUND', () => {
      const info = resolveProblemInfo('CATEGORY_ANALYTICS_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 409 entry for CATEGORY_SLUG_CONFLICT', () => {
      const info = resolveProblemInfo('CATEGORY_SLUG_CONFLICT');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for CATEGORY_ALREADY_ACTIVE', () => {
      const info = resolveProblemInfo('CATEGORY_ALREADY_ACTIVE');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 500 entry for CATEGORY_RESTORE_INVARIANT', () => {
      const info = resolveProblemInfo('CATEGORY_RESTORE_INVARIANT');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });
  });

  describe('resolveProblemInfo (tag module — Phase 2)', () => {
    it('returns a 404 entry for TAG_NOT_FOUND', () => {
      const info = resolveProblemInfo('TAG_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/tag-not-found');
    });

    it('returns a 404 entry for TAG_ANALYTICS_NOT_FOUND', () => {
      const info = resolveProblemInfo('TAG_ANALYTICS_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 409 entry for TAG_SLUG_CONFLICT', () => {
      const info = resolveProblemInfo('TAG_SLUG_CONFLICT');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for TAG_ALREADY_ACTIVE', () => {
      const info = resolveProblemInfo('TAG_ALREADY_ACTIVE');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 500 entry for TAG_RESTORE_INVARIANT', () => {
      const info = resolveProblemInfo('TAG_RESTORE_INVARIANT');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });
  });

  describe('resolveProblemInfo (tournament module — Phase 2, 15 entries)', () => {
    // 15 entries covering 4 status codes:
    //   404: TOURNAMENT_NOT_FOUND, TOURNAMENT_ROUND_NOT_FOUND, TOURNAMENT_NOT_REGISTERED
    //   403: TOURNAMENT_FORBIDDEN
    //   409: TOURNAMENT_CONFLICT, TOURNAMENT_ALREADY_REGISTERED, TOURNAMENT_ATTEMPT_ALREADY_EXISTS,
    //        TOURNAMENT_PARTICIPANT_STATE, TOURNAMENT_ALREADY_WITHDRAWN (was 500 in the prior filter)
    //   400: TOURNAMENT_VALIDATION, TOURNAMENT_REGISTRATION_CLOSED, TOURNAMENT_FULL,
    //        TOURNAMENT_ROUND_NOT_OPEN, TOURNAMENT_UNREGISTER_CLOSED, TOURNAMENT_WITHDRAW_CLOSED
    it('returns a 404 entry for TOURNAMENT_NOT_FOUND', () => {
      const info = resolveProblemInfo('TOURNAMENT_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/tournament-not-found');
    });

    it('returns a 404 entry for TOURNAMENT_ROUND_NOT_FOUND', () => {
      const info = resolveProblemInfo('TOURNAMENT_ROUND_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 404 entry for TOURNAMENT_NOT_REGISTERED', () => {
      const info = resolveProblemInfo('TOURNAMENT_NOT_REGISTERED');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 403 entry for TOURNAMENT_FORBIDDEN', () => {
      const info = resolveProblemInfo('TOURNAMENT_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 409 entry for TOURNAMENT_CONFLICT', () => {
      const info = resolveProblemInfo('TOURNAMENT_CONFLICT');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for TOURNAMENT_ALREADY_REGISTERED', () => {
      const info = resolveProblemInfo('TOURNAMENT_ALREADY_REGISTERED');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for TOURNAMENT_ATTEMPT_ALREADY_EXISTS', () => {
      const info = resolveProblemInfo('TOURNAMENT_ATTEMPT_ALREADY_EXISTS');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for TOURNAMENT_PARTICIPANT_STATE', () => {
      const info = resolveProblemInfo('TOURNAMENT_PARTICIPANT_STATE');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for TOURNAMENT_ALREADY_WITHDRAWN (was 500 in the prior filter)', () => {
      // Wire-shape fix: prior filter fell through to the 500 default
      // for this exception class. Phase 2 routes it to 409 (semantic
      // state conflict).
      const info = resolveProblemInfo('TOURNAMENT_ALREADY_WITHDRAWN');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 400 entry for TOURNAMENT_VALIDATION', () => {
      const info = resolveProblemInfo('TOURNAMENT_VALIDATION');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for TOURNAMENT_REGISTRATION_CLOSED', () => {
      const info = resolveProblemInfo('TOURNAMENT_REGISTRATION_CLOSED');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for TOURNAMENT_FULL', () => {
      const info = resolveProblemInfo('TOURNAMENT_FULL');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for TOURNAMENT_ROUND_NOT_OPEN', () => {
      const info = resolveProblemInfo('TOURNAMENT_ROUND_NOT_OPEN');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for TOURNAMENT_UNREGISTER_CLOSED', () => {
      const info = resolveProblemInfo('TOURNAMENT_UNREGISTER_CLOSED');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for TOURNAMENT_WITHDRAW_CLOSED', () => {
      const info = resolveProblemInfo('TOURNAMENT_WITHDRAW_CLOSED');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });
  });

  describe('resolveProblemInfo (review module — Phase 2, 6 entries)', () => {
    // 6 entries covering 4 status codes:
    //   404: REVIEW_NOT_FOUND
    //   403: REVIEW_FORBIDDEN
    //   409: REVIEW_CONFLICT, REVIEW_ALREADY_REPORTED
    //   400: REVIEW_VALIDATION, REVIEW_ATTEMPT_REQUIRED
    it('returns a 404 entry for REVIEW_NOT_FOUND', () => {
      const info = resolveProblemInfo('REVIEW_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/review-not-found');
    });

    it('returns a 403 entry for REVIEW_FORBIDDEN', () => {
      const info = resolveProblemInfo('REVIEW_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 409 entry for REVIEW_CONFLICT', () => {
      const info = resolveProblemInfo('REVIEW_CONFLICT');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for REVIEW_ALREADY_REPORTED', () => {
      const info = resolveProblemInfo('REVIEW_ALREADY_REPORTED');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 400 entry for REVIEW_VALIDATION', () => {
      const info = resolveProblemInfo('REVIEW_VALIDATION');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for REVIEW_ATTEMPT_REQUIRED', () => {
      const info = resolveProblemInfo('REVIEW_ATTEMPT_REQUIRED');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });
  });

  describe('resolveProblemInfo (bookmark module — Phase 2, 7 entries)', () => {
    // 7 entries covering 4 status codes:
    //   404: BOOKMARK_NOT_FOUND, BOOKMARK_COLLECTION_NOT_FOUND
    //   403: COLLECTION_FORBIDDEN
    //   409: BOOKMARK_CONFLICT, COLLECTION_CONFLICT
    //   400: BOOKMARK_VALIDATION
    it('returns a 404 entry for BOOKMARK_NOT_FOUND', () => {
      const info = resolveProblemInfo('BOOKMARK_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/bookmark-not-found');
    });

    it('returns a 404 entry for BOOKMARK_COLLECTION_NOT_FOUND', () => {
      const info = resolveProblemInfo('BOOKMARK_COLLECTION_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 403 entry for COLLECTION_FORBIDDEN', () => {
      const info = resolveProblemInfo('COLLECTION_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 409 entry for BOOKMARK_CONFLICT', () => {
      const info = resolveProblemInfo('BOOKMARK_CONFLICT');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for COLLECTION_CONFLICT', () => {
      const info = resolveProblemInfo('COLLECTION_CONFLICT');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 400 entry for BOOKMARK_VALIDATION', () => {
      const info = resolveProblemInfo('BOOKMARK_VALIDATION');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });
  });

  describe('resolveProblemInfo (instance module — Phase 2, 7 entries)', () => {
    // 7 entries covering 4 status codes:
    //   404: INSTANCE_NOT_FOUND
    //   403: INSTANCE_NOT_HOST
    //   409: PLAYER_ALREADY_JOINED (currently unused in service — see
    //        exception class docblock for details)
    //   400: INSTANCE_NOT_OPEN, INSTANCE_FULL, INSTANCE_ALREADY_STARTED,
    //        INSTANCE_ALREADY_CLOSED
    it('returns a 404 entry for INSTANCE_NOT_FOUND', () => {
      const info = resolveProblemInfo('INSTANCE_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/instance-not-found');
    });

    it('returns a 403 entry for INSTANCE_NOT_HOST', () => {
      const info = resolveProblemInfo('INSTANCE_NOT_HOST');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 400 entry for INSTANCE_NOT_OPEN', () => {
      const info = resolveProblemInfo('INSTANCE_NOT_OPEN');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for INSTANCE_FULL', () => {
      const info = resolveProblemInfo('INSTANCE_FULL');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for INSTANCE_ALREADY_STARTED', () => {
      const info = resolveProblemInfo('INSTANCE_ALREADY_STARTED');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 400 entry for INSTANCE_ALREADY_CLOSED', () => {
      const info = resolveProblemInfo('INSTANCE_ALREADY_CLOSED');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 409 entry for PLAYER_ALREADY_JOINED', () => {
      const info = resolveProblemInfo('PLAYER_ALREADY_JOINED');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });
  });

  describe('resolveProblemInfo (social module — Phase 2, 8 entries)', () => {
    // 8 entries covering 4 status codes:
    //   404: SOCIAL_FRIEND_REQUEST_NOT_FOUND
    //   403: SOCIAL_FRIEND_REQUEST_FORBIDDEN, SOCIAL_FRIEND_LIST_FORBIDDEN,
    //        SOCIAL_BLOCKED_USER, SOCIAL_USER_BLOCKED (4 distinct 403 codes)
    //   409: SOCIAL_ALREADY_FRIENDS, SOCIAL_PENDING_REQUEST_EXISTS
    //   400: SOCIAL_SELF_FRIEND_REQUEST
    it('returns a 404 entry for SOCIAL_FRIEND_REQUEST_NOT_FOUND', () => {
      const info = resolveProblemInfo('SOCIAL_FRIEND_REQUEST_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/social-friend-request-not-found');
    });

    it('returns a 403 entry for SOCIAL_FRIEND_REQUEST_FORBIDDEN', () => {
      const info = resolveProblemInfo('SOCIAL_FRIEND_REQUEST_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 403 entry for SOCIAL_FRIEND_LIST_FORBIDDEN', () => {
      const info = resolveProblemInfo('SOCIAL_FRIEND_LIST_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 403 entry for SOCIAL_BLOCKED_USER', () => {
      const info = resolveProblemInfo('SOCIAL_BLOCKED_USER');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 403 entry for SOCIAL_USER_BLOCKED', () => {
      const info = resolveProblemInfo('SOCIAL_USER_BLOCKED');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 400 entry for SOCIAL_SELF_FRIEND_REQUEST', () => {
      const info = resolveProblemInfo('SOCIAL_SELF_FRIEND_REQUEST');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });

    it('returns a 409 entry for SOCIAL_ALREADY_FRIENDS', () => {
      const info = resolveProblemInfo('SOCIAL_ALREADY_FRIENDS');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for SOCIAL_PENDING_REQUEST_EXISTS', () => {
      const info = resolveProblemInfo('SOCIAL_PENDING_REQUEST_EXISTS');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });
  });

  describe('resolveProblemInfo (achievement module — Phase 2, 4 entries)', () => {
    // 4 entries covering 2 status codes:
    //   404: BADGE_NOT_FOUND, ACHIEVEMENT_USER_NOT_FOUND,
    //        USER_BADGE_OWNERSHIP_NOT_FOUND (3)
    //   500: ACHIEVEMENT_GRANT_ERROR (1 — defined but unused in service)
    it('returns a 404 entry for BADGE_NOT_FOUND', () => {
      const info = resolveProblemInfo('BADGE_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/badge-not-found');
    });

    it('returns a 404 entry for ACHIEVEMENT_USER_NOT_FOUND', () => {
      const info = resolveProblemInfo('ACHIEVEMENT_USER_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 404 entry for USER_BADGE_OWNERSHIP_NOT_FOUND', () => {
      const info = resolveProblemInfo('USER_BADGE_OWNERSHIP_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 500 entry for ACHIEVEMENT_GRANT_ERROR', () => {
      const info = resolveProblemInfo('ACHIEVEMENT_GRANT_ERROR');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });
  });

  describe('resolveProblemInfo (comment module — Phase 9.5, 10 entries; reduced to 10 after Phase 1 audit removed unused ParentCommentNotFoundError)', () => {
    // 10 entries covering 4 status codes:
    //   404: COMMENT_NOT_FOUND, COMMENT_QUIZ_NOT_FOUND,
    //        COMMENT_REPORT_NOT_FOUND (3) - ParentCommentNotFoundError removed
    //   403: COMMENT_FORBIDDEN, COMMENT_SELF_VOTE,
    //        COMMENT_SELF_REPORT, COMMENT_MODERATOR_REQUIRED (4)
    //   409: COMMENT_REPLY_LIMIT_EXCEEDED, COMMENT_DUPLICATE_REPORT (2)
    //   400: COMMENT_PARENT_COMMENT_CROSS_THREAD (1)
    //
    // Total = 3 + 4 + 2 + 1 = 10.
    //
    // Plan §8.4.1 risk notes: two of the 10 errors map to non-obvious
    // statuses (`ParentCommentCrossThreadError` → 400;
    // `ModeratorRequiredError` → 403). These are captured here so a
    // future mapping change cannot silently regress them.
    it('returns a 404 entry for COMMENT_NOT_FOUND', () => {
      const info = resolveProblemInfo('COMMENT_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/comment-not-found');
    });

    it('returns a 404 entry for COMMENT_QUIZ_NOT_FOUND (collision with QUIZ_NOT_FOUND is documented at §9 item 1)', () => {
      // The comment-module version of `QuizNotFoundError` uses
      // `COMMENT_QUIZ_NOT_FOUND`; the quiz-module version uses
      // `QUIZ_NOT_FOUND`. Same class name, distinct `code`. Clients
      // should switch on `extensions.code`.
      const info = resolveProblemInfo('COMMENT_QUIZ_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 404 entry for COMMENT_REPORT_NOT_FOUND', () => {
      const info = resolveProblemInfo('COMMENT_REPORT_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
    });

    it('returns a 403 entry for COMMENT_FORBIDDEN', () => {
      const info = resolveProblemInfo('COMMENT_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 403 entry for COMMENT_SELF_VOTE', () => {
      const info = resolveProblemInfo('COMMENT_SELF_VOTE');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 403 entry for COMMENT_SELF_REPORT', () => {
      const info = resolveProblemInfo('COMMENT_SELF_REPORT');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 403 entry for COMMENT_MODERATOR_REQUIRED (non-obvious 403 per §8.4.1)', () => {
      // Plan §8.4.1 risk note: this is a non-obvious 403 (the class
      // name suggests 401 or 403 for "auth required", but the actual
      // semantic is "you're authenticated but lack the moderator
      // role"). The migration test captures it.
      const info = resolveProblemInfo('COMMENT_MODERATOR_REQUIRED');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });

    it('returns a 409 entry for COMMENT_REPLY_LIMIT_EXCEEDED', () => {
      const info = resolveProblemInfo('COMMENT_REPLY_LIMIT_EXCEEDED');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 409 entry for COMMENT_DUPLICATE_REPORT', () => {
      const info = resolveProblemInfo('COMMENT_DUPLICATE_REPORT');
      expect(info.status).toBe(HttpStatus.CONFLICT);
      expect(info.title).toBe('Conflict');
    });

    it('returns a 400 entry for COMMENT_PARENT_COMMENT_CROSS_THREAD (non-obvious 400 per §8.4.1)', () => {
      // Plan §8.4.1 risk note: this is a non-obvious 400 (one might
      // expect 409 Conflict for a cross-resource mismatch). The
      // migration test captures it.
      const info = resolveProblemInfo('COMMENT_PARENT_COMMENT_CROSS_THREAD');
      expect(info.status).toBe(HttpStatus.BAD_REQUEST);
      expect(info.title).toBe('BadRequest');
    });
  });

  describe('resolveProblemInfo (ranking module — Phase 3.2, 3 entries)', () => {
    // 3 entries covering 2 status codes:
    //   422: RANKING_INVALID_XP_EVENT (semantic upgrade — was 500
    //        catch-all under the prior @Catch() filter)
    //   500: RANKING_RANK_CALCULATION_ERROR, RANKING_PERIOD_RESET_ERROR
    it('returns a 422 entry for RANKING_INVALID_XP_EVENT (semantic upgrade from 500)', () => {
      // Wire-shape improvement: prior filter returned 500
      // catch-all; semantic correction moves it to 422
      // (rejected XP event input). The migration test captures it.
      const info = resolveProblemInfo('RANKING_INVALID_XP_EVENT');
      expect(info.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(info.title).toBe('UnprocessableEntity');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/ranking-invalid-xp-event');
    });

    it('returns a 500 entry for RANKING_RANK_CALCULATION_ERROR', () => {
      const info = resolveProblemInfo('RANKING_RANK_CALCULATION_ERROR');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });

    it('returns a 500 entry for RANKING_PERIOD_RESET_ERROR', () => {
      const info = resolveProblemInfo('RANKING_PERIOD_RESET_ERROR');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
    });
  });

  describe('resolveProblemInfo (notification module — Phase 5 missed-module cleanup, 2 entries)', () => {
    // Phase 5 (rev5.1) coverage: notification was inadvertently skipped
    // in Phases 1-3 because it had no per-module filter. After Phase 5
    // its errors resolve correctly (was: 500 catch-all via
    // `instanceof Error`; now: 404/403 via the mapping table).
    it('returns a 404 entry for NOTIFICATION_NOT_FOUND (was incorrectly 500 before Phase 5)', () => {
      const info = resolveProblemInfo('NOTIFICATION_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/notification-not-found');
    });

    it('returns a 403 entry for NOTIFICATION_FORBIDDEN (was incorrectly 500 before Phase 5)', () => {
      const info = resolveProblemInfo('NOTIFICATION_FORBIDDEN');
      expect(info.status).toBe(HttpStatus.FORBIDDEN);
      expect(info.title).toBe('Forbidden');
    });
  });

  describe('resolveProblemInfo (unknown code — loud-failure branch)', () => {
    it('returns a 500 entry with the generic title and 500 typeUri', () => {
      const info = resolveProblemInfo('NONEXISTENT_CODE_XYZ');
      expect(info.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(info.title).toBe('InternalServerError');
      expect(info.typeUri).toBe('https://api.quiz.local/problems/internal-server-error');
    });

    it('returns the same fallback regardless of the unknown code value', () => {
      const a = resolveProblemInfo('TYP_O_HERE');
      const b = resolveProblemInfo('DIFFERENT_UNKNOWN');
      expect(a.status).toBe(b.status);
      expect(a.title).toBe(b.title);
      expect(a.typeUri).toBe(b.typeUri);
    });
  });

  describe('typeUri contract', () => {
    it('every entry has a non-empty typeUri', () => {
      for (const [code, info] of Object.entries(ProblemCodeMapping)) {
        expect(typeof info.typeUri).toBe('string');
        expect(info.typeUri.length).toBeGreaterThan(0);
        expect(code).toBeTruthy();
      }
    });

    it('every entry has a numeric status', () => {
      for (const info of Object.values(ProblemCodeMapping)) {
        expect(typeof info.status).toBe('number');
      }
    });

    it('every entry has a non-empty title', () => {
      for (const info of Object.values(ProblemCodeMapping)) {
        expect(typeof info.title).toBe('string');
        expect(info.title.length).toBeGreaterThan(0);
      }
    });
  });
});
