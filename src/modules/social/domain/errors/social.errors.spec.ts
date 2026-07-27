import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  AlreadyFriendsError,
  BlockedUserError,
  FollowNotFoundError,
  FriendListForbiddenError,
  FriendRequestForbiddenError,
  FriendRequestNotFoundError,
  FriendshipNotFoundError,
  PendingRequestExistsError,
  SelfFriendRequestError,
  SocialError,
  UserBlockedError,
  UserNotBlockedError,
} from './social.errors';

type ExceptionCtor = new (...args: string[]) => BaseDomainException;

// Helper that invokes a constructor with a heterogeneous argument list
// while preserving the per-class constructor signatures. Each social
// exception takes zero or one `string` argument, so this cast is
// type-safe at the call site.
const make = <T extends ExceptionCtor>(Ctor: T, ...args: string[]): InstanceType<T> =>
  new Ctor(...(args as [string, ...string[]])) as unknown as InstanceType<T>;

const SOCIAL_CASES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: ExceptionCtor;
  readonly args: ReadonlyArray<string>;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'FriendRequestNotFoundError',
    ctor: FriendRequestNotFoundError,
    args: ['abc-123'],
    expectedCode: 'SOCIAL_FRIEND_REQUEST_NOT_FOUND',
    message: 'Friend request not found: abc-123',
  },
  {
    name: 'FriendRequestForbiddenError',
    ctor: FriendRequestForbiddenError,
    args: [],
    expectedCode: 'SOCIAL_FRIEND_REQUEST_FORBIDDEN',
    message: 'You do not have permission to respond to this friend request',
  },
  {
    name: 'FriendListForbiddenError',
    ctor: FriendListForbiddenError,
    args: [],
    expectedCode: 'SOCIAL_FRIEND_LIST_FORBIDDEN',
    message: 'You do not have permission to view this user\u2019s friend list',
  },
  {
    name: 'SelfFriendRequestError',
    ctor: SelfFriendRequestError,
    args: [],
    expectedCode: 'SOCIAL_SELF_FRIEND_REQUEST',
    message: 'You cannot send a friend request to yourself',
  },
  {
    name: 'AlreadyFriendsError',
    ctor: AlreadyFriendsError,
    args: [],
    expectedCode: 'SOCIAL_ALREADY_FRIENDS',
    message: 'You are already friends with this user',
  },
  {
    name: 'BlockedUserError',
    ctor: BlockedUserError,
    args: [],
    expectedCode: 'SOCIAL_BLOCKED_USER',
    message: 'Cannot perform this action on a blocked user',
  },
  {
    name: 'UserBlockedError',
    ctor: UserBlockedError,
    args: [],
    expectedCode: 'SOCIAL_USER_BLOCKED',
    message: 'This user has blocked you',
  },
  {
    name: 'PendingRequestExistsError',
    ctor: PendingRequestExistsError,
    args: [],
    expectedCode: 'SOCIAL_PENDING_REQUEST_EXISTS',
    message: 'A friend request is already pending',
  },
  {
    name: 'FriendshipNotFoundError',
    ctor: FriendshipNotFoundError,
    args: ['user-abc'],
    expectedCode: 'SOCIAL_FRIENDSHIP_NOT_FOUND',
    message: 'You are not friends with user user-abc',
  },
  {
    name: 'UserNotBlockedError',
    ctor: UserNotBlockedError,
    args: ['user-xyz'],
    expectedCode: 'SOCIAL_USER_NOT_BLOCKED',
    message: 'You have not blocked user user-xyz',
  },
  {
    name: 'FollowNotFoundError',
    ctor: FollowNotFoundError,
    args: ['user-qrs'],
    expectedCode: 'SOCIAL_FOLLOW_NOT_FOUND',
    message: 'You are not following user user-qrs',
  },
];

describe('Social-domain errors (RFC 7807 mapping completeness — Phase 2)', () => {
  describe.each(SOCIAL_CASES)('$name', ({ name, ctor, args, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends SocialError extends BaseDomainException)', () => {
      const instance = make(ctor, ...args);
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(SocialError);
    });

    it(`declares \`code = '${expectedCode}'\``, () => {
      const instance = make(ctor, ...args);
      expect(instance.code).toBe(expectedCode);
    });

    it(`'${expectedCode}' resolves in ProblemCodeMapping`, () => {
      expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, expectedCode)).toBe(true);
    });

    it('preserves the default message verbatim (no filtering on the wire)', () => {
      const instance = make(ctor, ...args);
      expect(instance.message).toBe(message);
    });

    it('sets `name` to the concrete class name (for log paths)', () => {
      const instance = make(ctor, ...args);
      expect(instance.name).toBe(name);
    });

    it('re-declares its `code` consistently across instances (no shared state)', () => {
      const a = make(ctor, ...args);
      const b = make(ctor, ...args);
      expect(a.code).toBe(b.code);
      expect(a.code).toBe(expectedCode);
    });
  });

  describe('FriendRequestNotFoundError constructor interpolation', () => {
    // Wire-shape improvement: prior per-module filter dropped the
    // request ID and rewrote every message to a hardcoded generic
    // `'Friend request not found'`. The global filter preserves the
    // thrown message including the interpolated ID. The ID is
    // interpolated at construction time via the constructor argument.

    it('interpolates a UUID-style ID into the message', () => {
      const id = 'f47ac10b-58cc-7372-a567-0e02b2c3d479';
      const instance = new FriendRequestNotFoundError(id);
      expect(instance.message).toBe(`Friend request not found: ${id}`);
    });

    it('interpolates an arbitrary string ID', () => {
      const id = 'req-001';
      const instance = new FriendRequestNotFoundError(id);
      expect(instance.message).toBe('Friend request not found: req-001');
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all social exceptions', () => {
      const codes = SOCIAL_CASES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only SOCIAL_* codes (no namespace pollution)', () => {
      for (const row of SOCIAL_CASES) {
        expect(row.expectedCode.startsWith('SOCIAL_')).toBe(true);
      }
    });

    it('every SOCIAL_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(SOCIAL_CASES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('SOCIAL_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('SocialError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new SocialError(...)`, that file would fail to
      // compile. We also assert below that no SOCIAL_CASES row
      // points at the abstract class itself.
      expect(typeof SocialError).toBe('function');
      const abstractAsValue: unknown = SocialError;
      expect(SOCIAL_CASES.find((row) => (row.ctor as unknown) === abstractAsValue)).toBeUndefined();
    });

    it('total exception count is 11 (matches the design plan)', () => {
      // 8 prior exceptions + 3 new from the audit-fix PR
      // (FriendshipNotFoundError, UserNotBlockedError,
      // FollowNotFoundError).
      //
      // This guards against accidental additions/removals during
      // refactors.
      expect(SOCIAL_CASES.length).toBe(11);
    });

    it('counted status-code buckets match the design plan', () => {
      // 11 entries covering 4 status codes:
      //   404: SOCIAL_FRIEND_REQUEST_NOT_FOUND, SOCIAL_FRIENDSHIP_NOT_FOUND,
      //        SOCIAL_USER_NOT_BLOCKED, SOCIAL_FOLLOW_NOT_FOUND (4)
      //   403: SOCIAL_FRIEND_REQUEST_FORBIDDEN, SOCIAL_FRIEND_LIST_FORBIDDEN,
      //        SOCIAL_BLOCKED_USER, SOCIAL_USER_BLOCKED (4)
      //   409: SOCIAL_ALREADY_FRIENDS, SOCIAL_PENDING_REQUEST_EXISTS (2)
      //   400: SOCIAL_SELF_FRIEND_REQUEST (1)
      // Total = 4 + 4 + 2 + 1 = 11.
      const byStatus = SOCIAL_CASES.reduce<Record<string, string[]>>((acc, row) => {
        const status = String(ProblemCodeMapping[row.expectedCode].status);
        if (!acc[status]) acc[status] = [];
        acc[status].push(row.expectedCode);
        return acc;
      }, {});
      expect(byStatus['404']?.length).toBe(4);
      expect(byStatus['403']?.length).toBe(4);
      expect(byStatus['409']?.length).toBe(2);
      expect(byStatus['400']?.length).toBe(1);
      expect(Object.values(byStatus).reduce((sum, list) => sum + list.length, 0)).toBe(
        SOCIAL_CASES.length,
      );
    });
  });
});
