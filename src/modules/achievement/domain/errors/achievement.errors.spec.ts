import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  AchievementDomainError,
  AchievementGrantError,
  AchievementUserNotFoundError,
  BadgeNotFoundError,
  UserBadgeOwnershipNotFoundError,
} from './achievement.errors';

const ACHIEVEMENT_CASES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (...args: string[]) => BaseDomainException;
  readonly args: ReadonlyArray<string>;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'BadgeNotFoundError',
    ctor: BadgeNotFoundError,
    args: ['badge-abc'],
    expectedCode: 'BADGE_NOT_FOUND',
    message: 'Badge not found: badge-abc',
  },
  {
    name: 'AchievementGrantError',
    ctor: AchievementGrantError,
    args: ['user-1', 'rule-engine-timeout'],
    expectedCode: 'ACHIEVEMENT_GRANT_ERROR',
    message: 'Failed to grant achievement',
  },
  {
    name: 'AchievementUserNotFoundError',
    ctor: AchievementUserNotFoundError,
    args: ['user-1'],
    expectedCode: 'ACHIEVEMENT_USER_NOT_FOUND',
    message: 'User not found: user-1',
  },
  {
    name: 'UserBadgeOwnershipNotFoundError',
    ctor: UserBadgeOwnershipNotFoundError,
    args: ['user-1', 'badge-abc'],
    expectedCode: 'USER_BADGE_OWNERSHIP_NOT_FOUND',
    message: 'Badge badge-abc not owned by user user-1',
  },
];

describe('Achievement-domain errors (RFC 7807 mapping completeness — Phase 2, final module)', () => {
  describe.each(ACHIEVEMENT_CASES)('$name', ({ name, ctor, args, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends AchievementDomainError extends BaseDomainException)', () => {
      const instance = new ctor(...args);
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(AchievementDomainError);
    });

    it(`declares \`code = '${expectedCode}'\``, () => {
      const instance = new ctor(...args);
      expect(instance.code).toBe(expectedCode);
    });

    it(`'${expectedCode}' resolves in ProblemCodeMapping`, () => {
      expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, expectedCode)).toBe(true);
    });

    it('preserves the default message verbatim (no filtering on the wire)', () => {
      const instance = new ctor(...args);
      expect(instance.message).toBe(message);
    });

    it('sets `name` to the concrete class name (for log paths)', () => {
      const instance = new ctor(...args);
      expect(instance.name).toBe(name);
    });

    it('re-declares its `code` consistently across instances (no shared state)', () => {
      const a = new ctor(...args);
      const b = new ctor(...args);
      expect(a.code).toBe(b.code);
      expect(a.code).toBe(expectedCode);
    });
  });

  describe('constructor context field', () => {
    // The prior `AchievementDomainError` base carried `context` on the
    // base class itself. After Phase 2 we keep `context` on subclasses
    // that have a meaningful context — the previous `mapToHttp`
    // discarded it, so the on-the-wire behavior is unchanged (the
    // context is still not exposed via ProblemDetailDto.extensions).
    // The field is retained here for in-process debugging — callers
    // and tests that introspect the exception get the same context
    // they always did.

    it('BadgeNotFoundError.context carries { badgeId }', () => {
      const instance = new BadgeNotFoundError('badge-abc');
      expect(instance.context).toEqual({ badgeId: 'badge-abc' });
    });

    it('AchievementGrantError.context carries { userId, reason }', () => {
      const instance = new AchievementGrantError('user-1', 'reason-x');
      expect(instance.context).toEqual({ userId: 'user-1', reason: 'reason-x' });
    });

    it('AchievementUserNotFoundError.context carries { userId }', () => {
      const instance = new AchievementUserNotFoundError('user-1');
      expect(instance.context).toEqual({ userId: 'user-1' });
    });

    it('UserBadgeOwnershipNotFoundError.context carries { userId, badgeId }', () => {
      const instance = new UserBadgeOwnershipNotFoundError('user-1', 'badge-abc');
      expect(instance.context).toEqual({ userId: 'user-1', badgeId: 'badge-abc' });
    });

    it('context values are read-only at the type level (public readonly field)', () => {
      // The TS signature declares `readonly context: { readonly ... }`
      // — the runtime enforces object identity but not nested
      // mutability. This test only verifies shape; assigning to
      // `instance.context` itself is a compile error.
      const instance = new BadgeNotFoundError('badge-abc');
      expect(instance.context.badgeId).toBe('badge-abc');
      expect(typeof instance.context).toBe('object');
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all achievement exceptions', () => {
      const codes = ACHIEVEMENT_CASES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only ACHIEVEMENT_* or BADGE_* or USER_BADGE_* codes (no namespace pollution)', () => {
      for (const row of ACHIEVEMENT_CASES) {
        const code = row.expectedCode;
        const matchesPrefix =
          code.startsWith('ACHIEVEMENT_') ||
          code.startsWith('BADGE_') ||
          code.startsWith('USER_BADGE_');
        expect(matchesPrefix).toBe(true);
      }
    });

    it('every ACHIEVEMENT_/BADGE_/USER_BADGE_ code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(ACHIEVEMENT_CASES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter(
        (k) =>
          k.startsWith('ACHIEVEMENT_') || k.startsWith('BADGE_') || k.startsWith('USER_BADGE_'),
      );
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('AchievementDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new AchievementDomainError(...)`, that file would fail
      // to compile. We also assert below that no ACHIEVEMENT_CASES
      // row points at the abstract class itself.
      expect(typeof AchievementDomainError).toBe('function');
      const abstractAsValue: unknown = AchievementDomainError;
      expect(
        ACHIEVEMENT_CASES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 4 (matches the design plan)', () => {
      // This guards against accidental additions/removals during
      // refactors. Smaller than other Phase-2 modules (most have 5–15
      // classes) because achievement has fewer distinct failure modes.
      expect(ACHIEVEMENT_CASES.length).toBe(4);
    });

    it('counted status-code buckets match the design plan', () => {
      // 4 entries covering 2 status codes:
      //   404: BADGE_NOT_FOUND, ACHIEVEMENT_USER_NOT_FOUND,
      //        USER_BADGE_OWNERSHIP_NOT_FOUND (3)
      //   500: ACHIEVEMENT_GRANT_ERROR (1)
      // Total = 3 + 1 = 4.
      const byStatus = ACHIEVEMENT_CASES.reduce<Record<string, string[]>>((acc, row) => {
        const status = String(ProblemCodeMapping[row.expectedCode].status);
        if (!acc[status]) acc[status] = [];
        acc[status].push(row.expectedCode);
        return acc;
      }, {});
      expect(byStatus['404']?.length).toBe(3);
      expect(byStatus['500']?.length).toBe(1);
      expect(Object.values(byStatus).reduce((sum, list) => sum + list.length, 0)).toBe(
        ACHIEVEMENT_CASES.length,
      );
    });
  });
});
