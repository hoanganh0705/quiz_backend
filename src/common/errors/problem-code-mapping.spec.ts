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
