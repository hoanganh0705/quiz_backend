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

    it('returns a 404 entry for USER_RANKING_NOT_FOUND (dead-code class with sensible mapping)', () => {
      const info = resolveProblemInfo('USER_RANKING_NOT_FOUND');
      expect(info.status).toBe(HttpStatus.NOT_FOUND);
      expect(info.title).toBe('NotFound');
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
