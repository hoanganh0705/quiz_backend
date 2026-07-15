import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  BookmarkCollectionNotFoundError,
  BookmarkConflictError,
  BookmarkDomainError,
  BookmarkNotFoundError,
  BookmarkValidationError,
  CollectionConflictError,
  CollectionForbiddenError,
} from './bookmark-domain.errors';

const BOOKMARK_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'BookmarkNotFoundError',
    ctor: BookmarkNotFoundError,
    expectedCode: 'BOOKMARK_NOT_FOUND',
    message: 'Bookmark not found',
  },
  {
    name: 'BookmarkCollectionNotFoundError',
    ctor: BookmarkCollectionNotFoundError,
    expectedCode: 'BOOKMARK_COLLECTION_NOT_FOUND',
    message: 'Bookmark collection not found',
  },
  {
    name: 'CollectionForbiddenError',
    ctor: CollectionForbiddenError,
    expectedCode: 'COLLECTION_FORBIDDEN',
    message: 'You do not have permission to manage this collection',
  },
  {
    name: 'BookmarkConflictError',
    ctor: BookmarkConflictError,
    expectedCode: 'BOOKMARK_CONFLICT',
    message: 'This quiz is already bookmarked in this collection',
  },
  {
    name: 'CollectionConflictError',
    ctor: CollectionConflictError,
    expectedCode: 'COLLECTION_CONFLICT',
    message: 'A collection with this name already exists',
  },
  {
    name: 'BookmarkValidationError',
    ctor: BookmarkValidationError,
    expectedCode: 'BOOKMARK_VALIDATION',
    message: 'Validation failed',
  },
];

describe('Bookmark-domain errors (RFC 7807 mapping completeness — Phase 2)', () => {
  describe.each(BOOKMARK_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends BookmarkDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(BookmarkDomainError);
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
    it('declares unique codes across all bookmark exceptions', () => {
      const codes = BOOKMARK_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only BOOKMARK_* or COLLECTION_* codes (no namespace pollution)', () => {
      for (const row of BOOKMARK_CODES) {
        const code = row.expectedCode;
        const isBookmark = code.startsWith('BOOKMARK_');
        const isCollection = code.startsWith('COLLECTION_');
        expect(isBookmark || isCollection).toBe(true);
      }
    });

    it('every BOOKMARK_* or COLLECTION_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(BOOKMARK_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter(
        (k) => k.startsWith('BOOKMARK_') || k.startsWith('COLLECTION_'),
      );
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('BookmarkDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new BookmarkDomainError(...)`, that file would fail to
      // compile. We also assert below that no BOOKMARK_CODES row
      // points at the abstract class itself.
      expect(typeof BookmarkDomainError).toBe('function');
      const abstractAsValue: unknown = BookmarkDomainError;
      expect(
        BOOKMARK_CODES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 6 (matches the design plan)', () => {
      // This guards against accidental additions/removals during
      // refactors. (Phase 4 X1 consolidated CollectionNotFoundError into
      // BookmarkCollectionNotFoundError, dropping the count from 7 to 6.)
      expect(BOOKMARK_CODES.length).toBe(6);
    });
  });
});
