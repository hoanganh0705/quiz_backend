import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  UserAnalyticsNotFoundError,
  UserDomainError,
  UserNotFoundError,
  UserRankingNotFoundError,
} from './user-domain.errors';
import { UserProfilePrivateError } from './user-profile-private.error';

/**
 * Every concrete user-module exception class plus the expected `code` it
 * declares. The test iterates this table and asserts per row:
 *   1. The class extends `BaseDomainException` (runtime check).
 *   2. The class extends `UserDomainError` (the module namespace marker).
 *   3. The class's `code` field is the expected string literal.
 *   4. The `code` resolves in `ProblemCodeMapping`.
 *   5. The default message is preserved verbatim.
 *   6. The class name is set on `error.name` (used by log paths).
 *
 * Two ctors in this module:
 *   - 3 of 4 classes accept an optional `message?: string`.
 *   - `UserProfilePrivateError` requires `targetUserId: string`. It is
 *     tested in its own describe block below to keep the table uniform.
 *
 * Adding a new exception? Add a row here (or a new describe block). The
 * unknown-code loud-failure branch in `GlobalExceptionFilter` plus this
 * spec together ensure no exception ships without a mapping entry.
 */
const USER_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'UserNotFoundError',
    ctor: UserNotFoundError,
    expectedCode: 'USER_NOT_FOUND',
    message: 'User not found',
  },
  {
    name: 'UserRankingNotFoundError',
    ctor: UserRankingNotFoundError,
    expectedCode: 'USER_RANKING_NOT_FOUND',
    message: 'User ranking not found',
  },
  {
    name: 'UserAnalyticsNotFoundError',
    ctor: UserAnalyticsNotFoundError,
    expectedCode: 'USER_ANALYTICS_NOT_FOUND',
    message: 'User analytics not found',
  },
];

describe('User-domain errors (RFC 7807 mapping completeness)', () => {
  describe.each(USER_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends UserDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(UserDomainError);
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

  describe('UserProfilePrivateError (targetUserId-ctor exception)', () => {
    it('is a BaseDomainException subclass (extends UserDomainError extends BaseDomainException)', () => {
      const instance = new UserProfilePrivateError('user-xyz');
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(UserDomainError);
    });

    it("declares `code = 'USER_PROFILE_PRIVATE'`", () => {
      const instance = new UserProfilePrivateError('user-xyz');
      expect(instance.code).toBe('USER_PROFILE_PRIVATE');
    });

    it("'USER_PROFILE_PRIVATE' resolves in ProblemCodeMapping", () => {
      expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, 'USER_PROFILE_PRIVATE')).toBe(
        true,
      );
    });

    it('builds a deterministic message from targetUserId (no custom override)', () => {
      const instance = new UserProfilePrivateError('user-xyz');
      expect(instance.message).toBe('Profile of user user-xyz is not public');
    });

    it("sets `name` to 'UserProfilePrivateError' (for log paths)", () => {
      const instance = new UserProfilePrivateError('user-xyz');
      expect(instance.name).toBe('UserProfilePrivateError');
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all user exceptions', () => {
      const codes = [...USER_CODES.map((row) => row.expectedCode), 'USER_PROFILE_PRIVATE'];
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only USER_* codes (no namespace pollution)', () => {
      const allCodes = [...USER_CODES.map((row) => row.expectedCode), 'USER_PROFILE_PRIVATE'];
      for (const code of allCodes) {
        expect(code.startsWith('USER_')).toBe(true);
      }
    });

    it('every USER_* code declared by an exception class resolves in ProblemCodeMapping', () => {
      // This invariant asserts the **declared → mapped** direction
      // (every declared code has a mapping entry) rather than the
      // **mapped → declared** direction. The latter would falsely
      // fail when a sibling module (e.g. achievement) declares a
      // `USER_BADGE_*` code — those are not owned by the user
      // module. See `achievement.errors.spec.ts` for the
      // achievement-module ownership of `USER_BADGE_OWNERSHIP_NOT_FOUND`.
      const declared = new Set([
        ...USER_CODES.map((row) => row.expectedCode),
        'USER_PROFILE_PRIVATE',
      ]);
      for (const code of declared) {
        expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, code)).toBe(true);
      }
    });

    it('UserDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new UserDomainError(...)`, that file would fail to
      // compile. We also assert below that no USER_CODES row points at
      // the abstract class itself.
      expect(typeof UserDomainError).toBe('function');
      const abstractAsValue: unknown = UserDomainError;
      expect(USER_CODES.find((row) => (row.ctor as unknown) === abstractAsValue)).toBeUndefined();
    });
  });
});
