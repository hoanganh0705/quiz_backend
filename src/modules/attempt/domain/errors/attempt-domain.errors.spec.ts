import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  AttemptAlreadyStartedError,
  AttemptAnswerNotFoundError,
  AttemptDomainError,
  AttemptForbiddenError,
  AttemptNotActiveError,
  AttemptNotCompletedError,
  AttemptNotFoundError,
  AttemptQuestionAlreadyAnsweredError,
  AttemptQuestionInvalidError,
  AttemptValidationError,
  QuizNotPublishedError,
} from './attempt-domain.errors';

/**
 * Every concrete attempt-module exception class plus the expected `code` it
 * declares. The test iterates this table and asserts per row:
 *   1. The class extends `BaseDomainException` (runtime check).
 *   2. The class extends `AttemptDomainError` (the module namespace marker).
 *   3. The class's `code` field is the expected string literal.
 *   4. The `code` resolves in `ProblemCodeMapping`.
 *   5. The default message is preserved verbatim.
 *   6. The class name is set on `error.name` (used by log paths).
 *   7. A custom message override is accepted without changing `code`.
 *
 * Adding a new exception? Add a row here. The unknown-code loud-failure
 * branch in `GlobalExceptionFilter` plus this spec together ensure no
 * exception ships without a mapping entry.
 *
 * Ctor signature: every concrete attempt exception takes an optional
 * `message?: string`, so the unified
 * `new (message?: string) => BaseDomainException` constructor type covers
 * the entire table.
 */
const ATTEMPT_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'AttemptNotFoundError',
    ctor: AttemptNotFoundError,
    expectedCode: 'ATTEMPT_NOT_FOUND',
    message: 'Quiz attempt not found',
  },
  {
    name: 'AttemptForbiddenError',
    ctor: AttemptForbiddenError,
    expectedCode: 'ATTEMPT_FORBIDDEN',
    message: 'You do not have permission to access this attempt',
  },
  {
    name: 'AttemptValidationError',
    ctor: AttemptValidationError,
    expectedCode: 'ATTEMPT_VALIDATION_FAILED',
    message: 'Validation failed',
  },
  {
    name: 'AttemptAlreadyStartedError',
    ctor: AttemptAlreadyStartedError,
    expectedCode: 'ATTEMPT_ALREADY_STARTED',
    message: 'You already have an active attempt for this quiz version',
  },
  {
    name: 'AttemptNotActiveError',
    ctor: AttemptNotActiveError,
    expectedCode: 'ATTEMPT_NOT_ACTIVE',
    message: 'Attempt is not active (already completed or abandoned)',
  },
  {
    name: 'AttemptQuestionAlreadyAnsweredError',
    ctor: AttemptQuestionAlreadyAnsweredError,
    expectedCode: 'ATTEMPT_QUESTION_ALREADY_ANSWERED',
    message: 'This question has already been answered in this attempt',
  },
  {
    name: 'QuizNotPublishedError',
    ctor: QuizNotPublishedError,
    expectedCode: 'ATTEMPT_QUIZ_NOT_PUBLISHED',
    message: 'This quiz is not published and cannot be attempted',
  },
  {
    name: 'AttemptQuestionInvalidError',
    ctor: AttemptQuestionInvalidError,
    expectedCode: 'ATTEMPT_QUESTION_INVALID',
    message: 'Question is invalid for this attempt',
  },
  {
    name: 'AttemptNotCompletedError',
    ctor: AttemptNotCompletedError,
    expectedCode: 'ATTEMPT_NOT_COMPLETED',
    message: 'Analytics are only available for completed attempts',
  },
  {
    name: 'AttemptAnswerNotFoundError',
    ctor: AttemptAnswerNotFoundError,
    expectedCode: 'ATTEMPT_ANSWER_NOT_FOUND',
    message: 'Answer to withdraw not found',
  },
];

describe('Attempt-domain errors (RFC 7807 mapping completeness)', () => {
  describe.each(ATTEMPT_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends AttemptDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(AttemptDomainError);
    });

    it(`declares \`code = '${expectedCode}'\``, () => {
      const instance = new ctor();
      expect(instance.code).toBe(expectedCode);
    });

    it(`'${expectedCode}' resolves in ProblemCodeMapping`, () => {
      expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, expectedCode)).toBe(true);
    });

    it(`preserves the default message verbatim (no filtering on the wire)`, () => {
      const instance = new ctor();
      expect(instance.message).toBe(message);
    });

    it(`sets \`name\` to the concrete class name (for log paths)`, () => {
      const instance = new ctor();
      expect(instance.name).toBe(name);
    });

    it(`accepts a custom message override`, () => {
      const instance = new ctor('custom override');
      expect(instance.message).toBe('custom override');
      // `code` is class-level and unaffected by message.
      expect(instance.code).toBe(expectedCode);
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all attempt exceptions', () => {
      const codes = ATTEMPT_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only ATTEMPT_* codes (no namespace pollution)', () => {
      for (const row of ATTEMPT_CODES) {
        expect(row.expectedCode.startsWith('ATTEMPT_')).toBe(true);
      }
    });

    it('every ATTEMPT_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(ATTEMPT_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('ATTEMPT_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('AttemptDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new AttemptDomainError(...)`, that file would fail to
      // compile. We also assert below that no ATTEMPT_CODES row points
      // at the abstract class itself.
      expect(typeof AttemptDomainError).toBe('function');
      const abstractAsValue: unknown = AttemptDomainError;
      expect(
        ATTEMPT_CODES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });
  });
});
