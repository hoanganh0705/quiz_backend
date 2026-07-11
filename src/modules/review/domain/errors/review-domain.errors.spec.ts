import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  ReviewAlreadyReportedError,
  ReviewAttemptRequiredError,
  ReviewConflictError,
  ReviewDomainError,
  ReviewForbiddenError,
  ReviewNotFoundError,
  ReviewValidationError,
} from './review-domain.errors';

const REVIEW_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'ReviewNotFoundError',
    ctor: ReviewNotFoundError,
    expectedCode: 'REVIEW_NOT_FOUND',
    message: 'Review not found',
  },
  {
    name: 'ReviewForbiddenError',
    ctor: ReviewForbiddenError,
    expectedCode: 'REVIEW_FORBIDDEN',
    message: 'You do not have permission to manage this review',
  },
  {
    name: 'ReviewConflictError',
    ctor: ReviewConflictError,
    expectedCode: 'REVIEW_CONFLICT',
    message: 'You have already reviewed this quiz',
  },
  {
    name: 'ReviewValidationError',
    ctor: ReviewValidationError,
    expectedCode: 'REVIEW_VALIDATION',
    message: 'Validation failed',
  },
  {
    name: 'ReviewAttemptRequiredError',
    ctor: ReviewAttemptRequiredError,
    expectedCode: 'REVIEW_ATTEMPT_REQUIRED',
    message: 'You must complete at least one attempt before reviewing this quiz',
  },
  {
    name: 'ReviewAlreadyReportedError',
    ctor: ReviewAlreadyReportedError,
    expectedCode: 'REVIEW_ALREADY_REPORTED',
    message: 'You have already reported this review',
  },
];

describe('Review-domain errors (RFC 7807 mapping completeness — Phase 2)', () => {
  describe.each(REVIEW_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends ReviewDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(ReviewDomainError);
    });

    it(`declares \`code = '${expectedCode}'\``, () => {
      const instance = new ctor();
      expect(instance.code).toBe(expectedCode);
    });

    it(`'${expectedCode}' resolves in ProblemCodeMapping`, () => {
      expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, expectedCode)).toBe(true);
    });

    it('preserves the default message verbatim (no filtering on the wire)', () => {
      const instance = new ctor();
      expect(instance.message).toBe(message);
    });

    it('sets `name` to the concrete class name (for log paths)', () => {
      const instance = new ctor();
      expect(instance.name).toBe(name);
    });

    it('accepts a custom message override', () => {
      const instance = new ctor('custom override');
      expect(instance.message).toBe('custom override');
      expect(instance.code).toBe(expectedCode);
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all review exceptions', () => {
      const codes = REVIEW_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only REVIEW_* codes (no namespace pollution)', () => {
      for (const row of REVIEW_CODES) {
        expect(row.expectedCode.startsWith('REVIEW_')).toBe(true);
      }
    });

    it('every REVIEW_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(REVIEW_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('REVIEW_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('ReviewDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new ReviewDomainError(...)`, that file would fail to
      // compile. We also assert below that no REVIEW_CODES row points
      // at the abstract class itself.
      expect(typeof ReviewDomainError).toBe('function');
      const abstractAsValue: unknown = ReviewDomainError;
      expect(REVIEW_CODES.find((row) => (row.ctor as unknown) === abstractAsValue)).toBeUndefined();
    });

    it('total exception count is 6 (matches the design plan)', () => {
      // This guards against accidental additions/removals during
      // refactors.
      expect(REVIEW_CODES.length).toBe(6);
    });
  });
});
