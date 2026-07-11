import { HttpStatus } from '@nestjs/common';
import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  CommentForbiddenError,
  CommentNotFoundError,
  CommentThreadMismatchError,
  DiscussionError,
  DuplicateReportError,
  ModeratorRequiredError,
  QuizNotFoundError,
  SelfReportError,
  SelfVoteError,
  ThreadClosedError,
  ThreadForbiddenError,
  ThreadNotActiveError,
  ThreadNotFoundError,
} from './index';

type ExceptionCtor = new (...args: string[]) => BaseDomainException;

// Helper that invokes a constructor with a heterogeneous argument list
// while preserving the per-class constructor signatures. Each discussion
// exception takes zero or one `string` argument, so this cast is
// type-safe at the call site.
const make = <T extends ExceptionCtor>(Ctor: T, ...args: string[]): InstanceType<T> =>
  new Ctor(...(args as [string, ...string[]])) as unknown as InstanceType<T>;

const DISCUSSION_CASES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: ExceptionCtor;
  readonly args: ReadonlyArray<string>;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'ThreadNotFoundError',
    ctor: ThreadNotFoundError,
    args: ['thread-1'],
    expectedCode: 'DISCUSSION_THREAD_NOT_FOUND',
    message: 'Thread not found: thread-1',
  },
  {
    name: 'CommentNotFoundError',
    ctor: CommentNotFoundError,
    args: ['comment-1'],
    expectedCode: 'DISCUSSION_COMMENT_NOT_FOUND',
    message: 'Comment not found: comment-1',
  },
  {
    name: 'ThreadForbiddenError',
    ctor: ThreadForbiddenError,
    args: [],
    expectedCode: 'DISCUSSION_THREAD_FORBIDDEN',
    message: 'You do not have permission to perform this action on this thread',
  },
  {
    name: 'CommentForbiddenError',
    ctor: CommentForbiddenError,
    args: [],
    expectedCode: 'DISCUSSION_COMMENT_FORBIDDEN',
    message: 'You do not have permission to perform this action on this comment',
  },
  {
    name: 'ThreadClosedError',
    ctor: ThreadClosedError,
    args: [],
    expectedCode: 'DISCUSSION_THREAD_CLOSED',
    message: 'This thread is closed and cannot accept new comments',
  },
  {
    name: 'ThreadNotActiveError',
    ctor: ThreadNotActiveError,
    args: [],
    expectedCode: 'DISCUSSION_THREAD_NOT_ACTIVE',
    message: 'This thread is not active and cannot be modified',
  },
  {
    name: 'CommentThreadMismatchError',
    ctor: CommentThreadMismatchError,
    args: [],
    expectedCode: 'DISCUSSION_COMMENT_THREAD_MISMATCH',
    message: 'The selected comment does not belong to this thread',
  },
  {
    name: 'SelfVoteError',
    ctor: SelfVoteError,
    args: [],
    expectedCode: 'DISCUSSION_SELF_VOTE',
    message: 'You cannot vote on your own content',
  },
  {
    name: 'SelfReportError',
    ctor: SelfReportError,
    args: [],
    expectedCode: 'DISCUSSION_SELF_REPORT',
    message: 'You cannot report your own content',
  },
  {
    name: 'DuplicateReportError',
    ctor: DuplicateReportError,
    args: [],
    expectedCode: 'DISCUSSION_DUPLICATE_REPORT',
    message: 'You have already reported this content',
  },
  {
    name: 'QuizNotFoundError',
    ctor: QuizNotFoundError,
    args: ['quiz-1'],
    expectedCode: 'DISCUSSION_QUIZ_NOT_FOUND',
    message: 'Quiz not found: quiz-1',
  },
  {
    name: 'ModeratorRequiredError',
    ctor: ModeratorRequiredError,
    args: [],
    expectedCode: 'DISCUSSION_MODERATOR_REQUIRED',
    message: 'Moderator or admin role is required to perform this action',
  },
];

describe('Discussion-domain errors (RFC 7807 mapping completeness — Phase 3.1)', () => {
  describe.each(DISCUSSION_CASES)('$name', ({ name, ctor, args, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends DiscussionError extends BaseDomainException)', () => {
      const instance = make(ctor, ...args);
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(DiscussionError);
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

  describe('constructor ID interpolation (4 classes that take an ID)', () => {
    // The prior per-module filter preserved these messages verbatim,
    // so behavior is unchanged. The migration test verifies the
    // interpolated ID is preserved.

    it('ThreadNotFoundError interpolates a thread ID', () => {
      const id = 'thread-abc-123';
      const instance = new ThreadNotFoundError(id);
      expect(instance.message).toBe(`Thread not found: ${id}`);
    });

    it('CommentNotFoundError interpolates a comment ID', () => {
      const id = 'comment-abc-123';
      const instance = new CommentNotFoundError(id);
      expect(instance.message).toBe(`Comment not found: ${id}`);
    });

    it('QuizNotFoundError interpolates a quiz ID (collision with QUIZ_NOT_FOUND is documented at §9 item 1)', () => {
      // The discussion-module version of `QuizNotFoundError` uses
      // `DISCUSSION_QUIZ_NOT_FOUND`; the quiz-module version uses
      // `QUIZ_NOT_FOUND`. Same class name, distinct `code`. Clients
      // should switch on `extensions.code`.
      const id = 'quiz-abc-123';
      const instance = new QuizNotFoundError(id);
      expect(instance.message).toBe(`Quiz not found: ${id}`);
      expect(instance.code).toBe('DISCUSSION_QUIZ_NOT_FOUND');
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all discussion exceptions', () => {
      const codes = DISCUSSION_CASES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only DISCUSSION_* codes (no namespace pollution)', () => {
      for (const row of DISCUSSION_CASES) {
        expect(row.expectedCode.startsWith('DISCUSSION_')).toBe(true);
      }
    });

    it('every DISCUSSION_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(DISCUSSION_CASES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('DISCUSSION_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('DiscussionError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new DiscussionError(...)`, that file would fail to
      // compile. We also assert below that no DISCUSSION_CASES row
      // points at the abstract class itself.
      expect(typeof DiscussionError).toBe('function');
      const abstractAsValue: unknown = DiscussionError;
      expect(
        DISCUSSION_CASES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 12 (matches the design plan §8.4.1)', () => {
      // Plan §8.4.1: "All 13 concrete subclasses get a `code`." — the
      // 13th is `UserNotFoundError`, but that class is owned by the
      // user module, not the discussion module. The discussion-module
      // spec owns 12 classes; the user module owns the 13th.
      expect(DISCUSSION_CASES.length).toBe(12);
    });

    it('counted status-code buckets match the design plan', () => {
      // 12 entries covering 4 status codes:
      //   404: DISCUSSION_THREAD_NOT_FOUND, DISCUSSION_COMMENT_NOT_FOUND,
      //        DISCUSSION_QUIZ_NOT_FOUND (3)
      //   403: DISCUSSION_THREAD_FORBIDDEN, DISCUSSION_COMMENT_FORBIDDEN,
      //        DISCUSSION_SELF_VOTE, DISCUSSION_SELF_REPORT,
      //        DISCUSSION_MODERATOR_REQUIRED (5)
      //   409: DISCUSSION_THREAD_CLOSED, DISCUSSION_THREAD_NOT_ACTIVE,
      //        DISCUSSION_DUPLICATE_REPORT (3)
      //   400: DISCUSSION_COMMENT_THREAD_MISMATCH (1)
      // Total = 3 + 5 + 3 + 1 = 12.
      //
      // Plan §8.4.1 risk notes (verified):
      //   - CommentThreadMismatchError → 400 (non-obvious — one
      //     might expect 409 Conflict for a cross-resource
      //     mismatch).
      //   - ModeratorRequiredError → 403 (non-obvious — the class
      //     name suggests 401 or 403 for "auth required", but the
      //     actual semantic is "you're authenticated but lack the
      //     moderator role").
      const byStatus = DISCUSSION_CASES.reduce<Record<string, string[]>>((acc, row) => {
        const status = String(ProblemCodeMapping[row.expectedCode].status);
        if (!acc[status]) acc[status] = [];
        acc[status].push(row.expectedCode);
        return acc;
      }, {});
      expect(byStatus['404']?.length).toBe(3);
      expect(byStatus['403']?.length).toBe(5);
      expect(byStatus['409']?.length).toBe(3);
      expect(byStatus['400']?.length).toBe(1);
      expect(Object.values(byStatus).reduce((sum, list) => sum + list.length, 0)).toBe(
        DISCUSSION_CASES.length,
      );
    });

    it('the two non-obvious status mappings are exactly as documented (regression guard for §8.4.1 risk note)', () => {
      // Plan §8.4.1 risk note: "Two of the 13 errors map to
      // non-obvious statuses (CommentThreadMismatchError → 400 —
      // BAD_REQUEST; ModeratorRequiredError → 403)." Capture these
      // explicitly so a future mapping change cannot silently
      // regress them to 409 and 401 respectively.
      expect(ProblemCodeMapping['DISCUSSION_COMMENT_THREAD_MISMATCH'].status).toBe(
        HttpStatus.BAD_REQUEST,
      );
      expect(ProblemCodeMapping['DISCUSSION_MODERATOR_REQUIRED'].status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
