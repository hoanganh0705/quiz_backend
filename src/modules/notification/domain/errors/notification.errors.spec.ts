import { HttpStatus } from '@nestjs/common';
import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  NotificationError,
  NotificationForbiddenError,
  NotificationNotFoundError,
} from './notification.errors';

type ExceptionCtor = new (...args: string[]) => BaseDomainException;

const make = <T extends ExceptionCtor>(Ctor: T, ...args: string[]): InstanceType<T> =>
  new Ctor(...(args as [string, ...string[]])) as unknown as InstanceType<T>;

const NOTIFICATION_CASES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: ExceptionCtor;
  readonly args: ReadonlyArray<string>;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'NotificationNotFoundError',
    ctor: NotificationNotFoundError,
    args: ['notif-1'],
    expectedCode: 'NOTIFICATION_NOT_FOUND',
    message: 'Notification not found: notif-1',
  },
  {
    name: 'NotificationForbiddenError',
    ctor: NotificationForbiddenError,
    args: [],
    expectedCode: 'NOTIFICATION_FORBIDDEN',
    message: 'You do not have permission to access this notification',
  },
];

describe('Notification-domain errors (RFC 7807 mapping completeness — Phase 5 missed-module cleanup)', () => {
  describe.each(NOTIFICATION_CASES)('$name', ({ name, ctor, args, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends NotificationError extends BaseDomainException)', () => {
      const instance = make(ctor, ...args);
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(NotificationError);
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

  describe('aggregate invariants', () => {
    it('declares unique codes across all notification exceptions', () => {
      const codes = NOTIFICATION_CASES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only NOTIFICATION_* codes (no namespace pollution)', () => {
      for (const row of NOTIFICATION_CASES) {
        expect(row.expectedCode.startsWith('NOTIFICATION_')).toBe(true);
      }
    });

    it('every NOTIFICATION_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(NOTIFICATION_CASES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('NOTIFICATION_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('NotificationError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new NotificationError(...)`, that file would fail to
      // compile. We also assert below that no NOTIFICATION_CASES row
      // points at the abstract class itself.
      expect(typeof NotificationError).toBe('function');
      const abstractAsValue: unknown = NotificationError;
      expect(
        NOTIFICATION_CASES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 2 (matches the audit at Phase 5 start)', () => {
      // Phase 5 audit: `grep -rn 'new Notification' src/` returns hits
      // only for `new NotificationNotFoundError(...)` and
      // `new NotificationForbiddenError()` — 2 concrete exception
      // classes, no abstract-base instantiation.
      expect(NOTIFICATION_CASES.length).toBe(2);
    });

    it('counted status-code buckets match the design plan', () => {
      // 2 entries covering 2 status codes:
      //   404: NOTIFICATION_NOT_FOUND (1)
      //   403: NOTIFICATION_FORBIDDEN (1)
      // Total = 1 + 1 = 2.
      //
      // Both are wire-shape improvements from the prior 500 catch-all
      // behavior (where `instanceof Error` routed both to 500).
      const byStatus = NOTIFICATION_CASES.reduce<Record<string, string[]>>((acc, row) => {
        const status = String(ProblemCodeMapping[row.expectedCode].status);
        if (!acc[status]) acc[status] = [];
        acc[status].push(row.expectedCode);
        return acc;
      }, {});
      expect(byStatus['404']?.length).toBe(1);
      expect(byStatus['403']?.length).toBe(1);
      expect(Object.values(byStatus).reduce((sum, list) => sum + list.length, 0)).toBe(
        NOTIFICATION_CASES.length,
      );
    });

    it('the 500 → 404 / 500 → 403 status corrections are exactly as documented (regression guard)', () => {
      // Plan: pre-Phase-5, both exceptions fell through the global
      // filter's `instanceof Error` branch and emitted 500 with
      // `title: 'InternalServerError'`. Phase 5 corrects both to their
      // semantic status codes.
      expect(ProblemCodeMapping['NOTIFICATION_NOT_FOUND'].status).toBe(HttpStatus.NOT_FOUND);
      expect(ProblemCodeMapping['NOTIFICATION_FORBIDDEN'].status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
