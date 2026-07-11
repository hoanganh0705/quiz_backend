import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  QuizAnswerOptionPositionConflictError,
  QuizConflictError,
  QuizDomainError,
  QuizForbiddenError,
  QuizInsufficientQuestionsError,
  QuizMultipleCorrectOptionsError,
  QuizNotFoundError,
  QuizOperationFailedError,
  QuizQuestionPositionConflictError,
  QuizSlugConflictError,
  QuizValidationError,
  QuizVersionImmutableError,
} from './quiz-domain.errors';

/**
 * Every concrete quiz-module exception class plus the expected `code` it
 * declares. The test iterates this table and asserts four things per row:
 *   1. The class extends `BaseDomainException` (compile-time + runtime).
 *   2. The class's `code` field is the expected string literal.
 *   3. The `code` resolves in `ProblemCodeMapping`.
 *   4. The default message is preserved verbatim.
 *
 * Adding a new exception? Add a row here. The unknown-code loud-failure
 * branch in `GlobalExceptionFilter` plus this spec together ensure no
 * exception ships without a mapping entry.
 *
 * Note on ctor signatures: every concrete quiz exception takes an optional
 * message parameter (`message?: string`), so the unified
 * `new (message?: string) => BaseDomainException` constructor type covers
 * the entire table.
 */
const QUIZ_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'QuizOperationFailedError',
    ctor: QuizOperationFailedError,
    expectedCode: 'QUIZ_OPERATION_FAILED',
    message: 'Quiz operation failed',
  },
  {
    name: 'QuizNotFoundError',
    ctor: QuizNotFoundError,
    expectedCode: 'QUIZ_NOT_FOUND',
    message: 'Quiz not found',
  },
  {
    name: 'QuizForbiddenError',
    ctor: QuizForbiddenError,
    expectedCode: 'QUIZ_FORBIDDEN',
    message: 'You do not have permission to manage this quiz',
  },
  {
    name: 'QuizSlugConflictError',
    ctor: QuizSlugConflictError,
    expectedCode: 'QUIZ_SLUG_CONFLICT',
    message: 'A quiz with this slug already exists',
  },
  {
    name: 'QuizConflictError',
    ctor: QuizConflictError,
    expectedCode: 'QUIZ_CONFLICT',
    message: 'Resource conflict',
  },
  {
    name: 'QuizValidationError',
    ctor: QuizValidationError,
    expectedCode: 'QUIZ_VALIDATION_FAILED',
    message: 'Validation failed',
  },
  {
    name: 'QuizVersionImmutableError',
    ctor: QuizVersionImmutableError,
    expectedCode: 'QUIZ_VERSION_IMMUTABLE',
    message: 'This quiz version cannot be modified',
  },
  {
    name: 'QuizInsufficientQuestionsError',
    ctor: QuizInsufficientQuestionsError,
    expectedCode: 'QUIZ_INSUFFICIENT_QUESTIONS',
    message: 'Quiz version must contain at least 5 questions before publishing',
  },
  {
    name: 'QuizQuestionPositionConflictError',
    ctor: QuizQuestionPositionConflictError,
    expectedCode: 'QUIZ_QUESTION_POSITION_CONFLICT',
    message: 'A question with this position already exists in the quiz version',
  },
  {
    name: 'QuizAnswerOptionPositionConflictError',
    ctor: QuizAnswerOptionPositionConflictError,
    expectedCode: 'QUIZ_ANSWER_OPTION_POSITION_CONFLICT',
    message: 'An answer option with this position already exists in the question',
  },
  {
    name: 'QuizMultipleCorrectOptionsError',
    ctor: QuizMultipleCorrectOptionsError,
    expectedCode: 'QUIZ_MULTIPLE_CORRECT_OPTIONS',
    message: 'A question must have exactly one correct answer option',
  },
];

describe('Quiz-domain errors (RFC 7807 mapping completeness)', () => {
  describe.each(QUIZ_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends QuizDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(QuizDomainError);
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
    it('declares unique codes across all quiz exceptions', () => {
      const codes = QUIZ_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only QUIZ_* codes (no namespace pollution)', () => {
      for (const row of QUIZ_CODES) {
        expect(row.expectedCode.startsWith('QUIZ_')).toBe(true);
      }
    });

    it('every QUIZ_* (non-analytics) code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(QUIZ_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter(
        (k) => k.startsWith('QUIZ_') && !k.startsWith('QUIZ_ANALYTICS_'),
      );
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('QuizDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new QuizDomainError(...)`, that file would fail to
      // compile. We also assert below that no QUIZ_CODES row points at
      // the abstract class itself.
      expect(typeof QuizDomainError).toBe('function');
      // The check below uses the abstract class's *runtime constructor
      // identity* (a function reference) rather than its type — TypeScript
      // would otherwise reject the comparison as "no overlap" between
      // the abstract class's static type and the concrete ctor signature.
      const abstractAsValue: unknown = QuizDomainError;
      expect(QUIZ_CODES.find((row) => (row.ctor as unknown) === abstractAsValue)).toBeUndefined();
    });
  });
});
