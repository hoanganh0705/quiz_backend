import { HttpStatus } from '@nestjs/common';
import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  CommentError,
  CommentForbiddenError,
  CommentNotFoundError,
  DuplicateReportError,
  ModeratorRequiredError,
  ParentCommentCrossThreadError,
  QuizNotFoundError,
  ReplyLimitExceededError,
  ReportNotFoundError,
  SelfReportError,
  SelfVoteError,
} from './index';

type ExceptionCtor = new (...args: unknown[]) => BaseDomainException;

// Helper that invokes a constructor with a heterogeneous argument list
// while preserving the per-class constructor signatures. Each comment
// exception takes zero or one argument (string for ids, number for the
// reply-limit cap), so `unknown[]` is the broadest type we can use
// without weakening any other assertion.
const make = <T extends ExceptionCtor>(Ctor: T, ...args: unknown[]): InstanceType<T> =>
  new Ctor(...(args as ConstructorParameters<T>)) as unknown as InstanceType<T>;

const COMMENT_CASES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: ExceptionCtor;
  readonly args: ReadonlyArray<unknown>;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'CommentNotFoundError',
    ctor: CommentNotFoundError as unknown as ExceptionCtor,
    args: ['comment-1'],
    expectedCode: 'COMMENT_NOT_FOUND',
    message: 'Comment not found: comment-1',
  },
  {
    name: 'CommentForbiddenError',
    ctor: CommentForbiddenError,
    args: [],
    expectedCode: 'COMMENT_FORBIDDEN',
    message: 'You do not have permission to perform this action on this comment',
  },
  {
    name: 'QuizNotFoundError',
    ctor: QuizNotFoundError as unknown as ExceptionCtor,
    args: ['quiz-1'],
    expectedCode: 'COMMENT_QUIZ_NOT_FOUND',
    message: 'Quiz not found: quiz-1',
  },
  {
    name: 'ParentCommentCrossThreadError',
    ctor: ParentCommentCrossThreadError,
    args: [],
    expectedCode: 'COMMENT_PARENT_COMMENT_CROSS_THREAD',
    message: 'The selected parent comment is not a top-level comment on this quiz',
  },
  {
    name: 'ReplyLimitExceededError',
    ctor: ReplyLimitExceededError as unknown as ExceptionCtor,
    args: ['100'],
    expectedCode: 'COMMENT_REPLY_LIMIT_EXCEEDED',
    message: 'Maximum reply limit of 100 reached for this comment',
  },
  {
    name: 'SelfVoteError',
    ctor: SelfVoteError,
    args: [],
    expectedCode: 'COMMENT_SELF_VOTE',
    message: 'You cannot vote on your own comment',
  },
  {
    name: 'SelfReportError',
    ctor: SelfReportError as unknown as ExceptionCtor,
    args: [],
    expectedCode: 'COMMENT_SELF_REPORT',
    message: 'You cannot report your own comment',
  },
  {
    name: 'DuplicateReportError',
    ctor: DuplicateReportError as unknown as ExceptionCtor,
    args: [],
    expectedCode: 'COMMENT_DUPLICATE_REPORT',
    message: 'You have already reported this comment',
  },
  {
    name: 'ReportNotFoundError',
    ctor: ReportNotFoundError as unknown as ExceptionCtor,
    args: ['report-1'],
    expectedCode: 'COMMENT_REPORT_NOT_FOUND',
    message: 'Report not found: report-1',
  },
  {
    name: 'ModeratorRequiredError',
    ctor: ModeratorRequiredError,
    args: [],
    expectedCode: 'COMMENT_MODERATOR_REQUIRED',
    message: 'Moderator or admin role is required to perform this action',
  },
];

describe('Comment-domain errors (RFC 7807 mapping completeness — Phase 9.5)', () => {
  describe.each(COMMENT_CASES)('$name', ({ name, ctor, args, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends CommentError extends BaseDomainException)', () => {
      const instance = make(ctor, ...args);
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(CommentError);
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
    it('CommentNotFoundError interpolates a comment ID', () => {
      const id = 'comment-abc-123';
      const instance = new CommentNotFoundError(id);
      expect(instance.message).toBe(`Comment not found: ${id}`);
    });

    it('QuizNotFoundError interpolates a quiz ID (collision with QUIZ_NOT_FOUND is documented at §9 item 1)', () => {
      // The comment-module version of `QuizNotFoundError` uses
      // `COMMENT_QUIZ_NOT_FOUND`; the quiz-module version uses
      // `QUIZ_NOT_FOUND`. Same class name, distinct `code`. Clients
      // should switch on `extensions.code`.
      const id = 'quiz-abc-123';
      const instance = new QuizNotFoundError(id);
      expect(instance.message).toBe(`Quiz not found: ${id}`);
      expect(instance.code).toBe('COMMENT_QUIZ_NOT_FOUND');
    });

    it('ReportNotFoundError interpolates a report ID', () => {
      const id = 'report-abc-123';
      const instance = new ReportNotFoundError(id);
      expect(instance.message).toBe(`Report not found: ${id}`);
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all comment exceptions', () => {
      const codes = COMMENT_CASES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only COMMENT_* codes (no namespace pollution)', () => {
      for (const row of COMMENT_CASES) {
        expect(row.expectedCode.startsWith('COMMENT_')).toBe(true);
      }
    });

    it('every COMMENT_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(COMMENT_CASES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('COMMENT_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('CommentError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new CommentError(...)`, that file would fail to
      // compile. We also assert below that no COMMENT_CASES row
      // points at the abstract class itself.
      expect(typeof CommentError).toBe('function');
      const abstractAsValue: unknown = CommentError;
      expect(
        COMMENT_CASES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 10 (matches the design plan §3.6; reduced to 10 after Phase 1 audit removed unused ParentCommentNotFoundError)', () => {
      expect(COMMENT_CASES.length).toBe(10);
    });

    it('counted status-code buckets match the design plan', () => {
      // 10 entries covering 4 status codes:
      //   404: COMMENT_NOT_FOUND, COMMENT_QUIZ_NOT_FOUND,
      //        COMMENT_REPORT_NOT_FOUND (3) - ParentCommentNotFoundError removed in Phase 1
      //   403: COMMENT_FORBIDDEN, COMMENT_SELF_VOTE,
      //        COMMENT_SELF_REPORT, COMMENT_MODERATOR_REQUIRED (4)
      //   409: COMMENT_REPLY_LIMIT_EXCEEDED, COMMENT_DUPLICATE_REPORT (2)
      //   400: COMMENT_PARENT_COMMENT_CROSS_THREAD (1)
      // Total = 3 + 4 + 2 + 1 = 10.
      const byStatus = COMMENT_CASES.reduce<Record<string, string[]>>((acc, row) => {
        const status = String(ProblemCodeMapping[row.expectedCode].status);
        if (!acc[status]) acc[status] = [];
        acc[status].push(row.expectedCode);
        return acc;
      }, {});
      expect(byStatus['404']?.length).toBe(3); // Reduced from 4 (ParentCommentNotFoundError removed)
      expect(byStatus['403']?.length).toBe(4);
      expect(byStatus['409']?.length).toBe(2);
      expect(byStatus['400']?.length).toBe(1);
      expect(Object.values(byStatus).reduce((sum, list) => sum + list.length, 0)).toBe(
        COMMENT_CASES.length,
      );
    });

    it('the non-obvious 400 mapping for ParentCommentCrossThreadError is preserved (regression guard for §8.4.1 risk note)', () => {
      // Plan §8.4.1 risk note: this class's 400 status is non-obvious
      // from the class name (one might expect 409 Conflict for a
      // cross-resource mismatch). The migration test captures it.
      expect(ProblemCodeMapping['COMMENT_PARENT_COMMENT_CROSS_THREAD'].status).toBe(
        HttpStatus.BAD_REQUEST,
      );
    });

    it('the non-obvious 403 mapping for ModeratorRequiredError is preserved (regression guard for §8.4.1 risk note)', () => {
      // Plan §8.4.1 risk note: the class name suggests 401 or 403 for
      // "auth required", but the actual semantic is "you're
      // authenticated but lack the moderator role". 403 is correct.
      expect(ProblemCodeMapping['COMMENT_MODERATOR_REQUIRED'].status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
