import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  TagAlreadyActiveError,
  TagAnalyticsNotFoundError,
  TagDomainError,
  TagNotFoundError,
  TagRestoreInvariantError,
  TagSlugConflictError,
} from './tag-domain.errors';

/**
 * Every concrete tag-module exception class plus the expected `code` it
 * declares. The test iterates this table and asserts per row:
 *   1. The class extends `BaseDomainException` (runtime check).
 *   2. The class extends `TagDomainError` (the module namespace marker).
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
 * Phase-2 note: structurally identical to the category spec — same 5
 * status mapping (404/404/409/409/500), same wire-shape improvements,
 * same legacy envelope replacement. Kept as a separate spec because the
 * code-name namespaces are independent (TAG_* vs. CATEGORY_*).
 */
const TAG_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'TagNotFoundError',
    ctor: TagNotFoundError,
    expectedCode: 'TAG_NOT_FOUND',
    message: 'Tag not found',
  },
  {
    name: 'TagAnalyticsNotFoundError',
    ctor: TagAnalyticsNotFoundError,
    expectedCode: 'TAG_ANALYTICS_NOT_FOUND',
    message: 'Tag analytics not found',
  },
  {
    name: 'TagSlugConflictError',
    ctor: TagSlugConflictError,
    expectedCode: 'TAG_SLUG_CONFLICT',
    message: 'A tag with this slug already exists',
  },
  {
    name: 'TagAlreadyActiveError',
    ctor: TagAlreadyActiveError,
    expectedCode: 'TAG_ALREADY_ACTIVE',
    message: 'Tag is already active and cannot be restored',
  },
  {
    name: 'TagRestoreInvariantError',
    ctor: TagRestoreInvariantError,
    expectedCode: 'TAG_RESTORE_INVARIANT',
    message: 'Tag restore invariant violated',
  },
];

describe('Tag-domain errors (RFC 7807 mapping completeness — Phase 2)', () => {
  describe.each(TAG_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends TagDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(TagDomainError);
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
      expect(instance.code).toBe(expectedCode);
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all tag exceptions', () => {
      const codes = TAG_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only TAG_* codes (no namespace pollution)', () => {
      for (const row of TAG_CODES) {
        expect(row.expectedCode.startsWith('TAG_')).toBe(true);
      }
    });

    it('every TAG_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(TAG_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('TAG_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('TagDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new TagDomainError(...)`, that file would fail to
      // compile. We also assert below that no TAG_CODES row points at
      // the abstract class itself.
      expect(typeof TagDomainError).toBe('function');
      const abstractAsValue: unknown = TagDomainError;
      expect(TAG_CODES.find((row) => (row.ctor as unknown) === abstractAsValue)).toBeUndefined();
    });
  });
});
