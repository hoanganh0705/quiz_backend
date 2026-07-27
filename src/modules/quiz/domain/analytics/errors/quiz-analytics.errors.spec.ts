import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  AnalyticsCalculationError,
  QuizAnalyticsError,
  QuizNotFoundError,
} from './quiz-analytics.errors';

/**
 * Every concrete quiz-analytics exception class plus the expected `code`.
 *
 * Note on the `QuizNotFoundError` class name collision: there are three
 * classes named `QuizNotFoundError` in this codebase
 *   - quiz/domain/errors/quiz-domain.errors.ts     (code QUIZ_NOT_FOUND)
 *   - quiz/domain/analytics/errors/quiz-analytics.errors.ts  (this file)
 *   - comments/domain/errors/index.ts            (code COMMENT_QUIZ_NOT_FOUND, planned for Phase 1 user-module PR)
 *
 * They are distinct classes at runtime. The Phase 0/1 spec does not
 * unify them — that cross-module coordination is captured in plan §9
 * item 1.
 */
const ANALYTICS_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (arg: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'QuizNotFoundError (analytics)',
    ctor: QuizNotFoundError,
    expectedCode: 'QUIZ_ANALYTICS_NOT_FOUND',
    message: 'Quiz not found: abc-123',
  },
  {
    name: 'AnalyticsCalculationError',
    ctor: AnalyticsCalculationError,
    expectedCode: 'QUIZ_ANALYTICS_CALCULATION_FAILED',
    message: 'Analytics calculation failed: divide by zero',
  },
];

describe('Quiz-analytics errors (RFC 7807 mapping completeness)', () => {
  describe.each(ANALYTICS_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends QuizAnalyticsError extends BaseDomainException)', () => {
      // The ctor signature is `(arg: string) => ...` for both classes;
      // the *meaning* of the arg differs (quizId vs. inner message).
      const arg = 'abc-123';
      const instance = new ctor(arg);
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(QuizAnalyticsError);
    });

    it(`declares \`code = '${expectedCode}'\``, () => {
      const instance = new ctor('abc-123');
      expect(instance.code).toBe(expectedCode);
    });

    it(`'${expectedCode}' resolves in ProblemCodeMapping`, () => {
      expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, expectedCode)).toBe(true);
    });

    it(`preserves the default-formatted message verbatim (no filtering on the wire)`, () => {
      // Use a recognizable quizId/message so the formatted default is
      // unambiguous. The exact format (`'Quiz not found: <id>'` and
      // `'Analytics calculation failed: <inner>'`) is the contract —
      // changing it is a wire-shape change.
      const instance =
        name === 'QuizNotFoundError (analytics)' ? new ctor('abc-123') : new ctor('divide by zero');
      expect(instance.message).toBe(message);
    });

    it(`sets \`name\` to the concrete class name`, () => {
      const instance = new ctor('anything');
      // The class name on the Error instance is the *declared* name
      // (e.g. 'QuizNotFoundError'), even though the analytics one shares
      // that name with the quiz-main and comments variants. The
      // TypeScript runtime distinguishes them by reference, not by name.
      const expectedName =
        name === 'QuizNotFoundError (analytics)'
          ? 'QuizNotFoundError'
          : 'AnalyticsCalculationError';
      expect(instance.name).toBe(expectedName);
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all quiz-analytics exceptions', () => {
      const codes = ANALYTICS_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only QUIZ_ANALYTICS_* codes (no namespace pollution)', () => {
      for (const row of ANALYTICS_CODES) {
        expect(row.expectedCode.startsWith('QUIZ_ANALYTICS_')).toBe(true);
      }
    });

    it('every QUIZ_ANALYTICS_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(ANALYTICS_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('QUIZ_ANALYTICS_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('QuizAnalyticsError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // See the matching test in quiz-domain.errors.spec.ts for the
      // rationale: `abstract` is compile-time-only. We assert the
      // constructor exists, no ANALYTICS_CODES row points at the
      // abstract class itself, and `tsc --noEmit` is clean.
      expect(typeof QuizAnalyticsError).toBe('function');
      const abstractAsValue: unknown = QuizAnalyticsError;
      expect(
        ANALYTICS_CODES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });
  });
});
