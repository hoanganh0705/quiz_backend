import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  CategoryAlreadyActiveError,
  CategoryAnalyticsNotFoundError,
  CategoryDomainError,
  CategoryFollowNotFoundError,
  CategoryNotFoundError,
  CategoryRestoreInvariantError,
  CategorySlugConflictError,
} from './category-domain.errors';

/**
 * Every concrete category-module exception class plus the expected `code`
 * it declares. The test iterates this table and asserts per row:
 *   1. The class extends `BaseDomainException` (runtime check).
 *   2. The class extends `CategoryDomainError` (the module namespace marker).
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
 * Phase-2 note: this is the first module whose per-module filter
 * returned the legacy `{ statusCode, message, error }` envelope. The
 * spec still asserts message preservation because the global filter
 * resolves `detail = exception.message` — the wire-shape change is
 * fully captured by the e2e tests in `rfc7807.e2e-spec.ts`, while this
 * unit spec focuses on mapping completeness.
 */
const CATEGORY_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'CategoryNotFoundError',
    ctor: CategoryNotFoundError,
    expectedCode: 'CATEGORY_NOT_FOUND',
    message: 'Category not found',
  },
  {
    name: 'CategoryAnalyticsNotFoundError',
    ctor: CategoryAnalyticsNotFoundError,
    expectedCode: 'CATEGORY_ANALYTICS_NOT_FOUND',
    message: 'Category analytics not found',
  },
  {
    name: 'CategoryFollowNotFoundError',
    ctor: CategoryFollowNotFoundError,
    expectedCode: 'CATEGORY_FOLLOW_NOT_FOUND',
    message: 'You are not following this category',
  },
  {
    name: 'CategorySlugConflictError',
    ctor: CategorySlugConflictError,
    expectedCode: 'CATEGORY_SLUG_CONFLICT',
    message: 'A category with this slug already exists',
  },
  {
    name: 'CategoryAlreadyActiveError',
    ctor: CategoryAlreadyActiveError,
    expectedCode: 'CATEGORY_ALREADY_ACTIVE',
    message: 'Category is already active and cannot be restored',
  },
  {
    name: 'CategoryRestoreInvariantError',
    ctor: CategoryRestoreInvariantError,
    expectedCode: 'CATEGORY_RESTORE_INVARIANT',
    message: 'Category restore invariant violated',
  },
];

describe('Category-domain errors (RFC 7807 mapping completeness — Phase 2)', () => {
  describe.each(CATEGORY_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends CategoryDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(CategoryDomainError);
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
    it('declares unique codes across all category exceptions', () => {
      const codes = CATEGORY_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only CATEGORY_* codes (no namespace pollution)', () => {
      for (const row of CATEGORY_CODES) {
        expect(row.expectedCode.startsWith('CATEGORY_')).toBe(true);
      }
    });

    it('every CATEGORY_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(CATEGORY_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('CATEGORY_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('CategoryDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new CategoryDomainError(...)`, that file would fail to
      // compile. We also assert below that no CATEGORY_CODES row points
      // at the abstract class itself.
      expect(typeof CategoryDomainError).toBe('function');
      const abstractAsValue: unknown = CategoryDomainError;
      expect(
        CATEGORY_CODES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });
  });
});
