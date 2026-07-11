import { HttpStatus } from '@nestjs/common';
import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  InvalidXpEventError,
  PeriodResetError,
  RankCalculationError,
  RankingDomainError,
} from './ranking-domain.errors';

type ExceptionCtor = new (...args: unknown[]) => BaseDomainException;

// Helper that invokes a constructor with a heterogeneous argument list
// while preserving the per-class constructor signatures. The three
// ranking exceptions take different argument shapes:
//   - InvalidXpEventError(event, reason)
//   - RankCalculationError(period, reason, context?)
//   - PeriodResetError(period, reason, context?)
// Casting to `unknown[]` keeps the tuple typing from the call sites
// type-safe at the call site.
const make = <T extends ExceptionCtor>(Ctor: T, ...args: unknown[]): InstanceType<T> =>
  new Ctor(...(args as [unknown, ...unknown[]])) as unknown as InstanceType<T>;

const RANKING_CASES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: ExceptionCtor;
  readonly args: ReadonlyArray<unknown>;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'InvalidXpEventError',
    ctor: InvalidXpEventError,
    args: [{ userId: 'u-1', amount: -5 }, 'Amount must be positive'],
    expectedCode: 'RANKING_INVALID_XP_EVENT',
    message: 'Invalid XP event: Amount must be positive',
  },
  {
    name: 'RankCalculationError',
    ctor: RankCalculationError,
    args: ['daily', 'db deadlock'],
    expectedCode: 'RANKING_RANK_CALCULATION_ERROR',
    message: 'Rank calculation failed for daily: db deadlock',
  },
  {
    name: 'PeriodResetError',
    ctor: PeriodResetError,
    args: ['weekly', 'scheduler offline'],
    expectedCode: 'RANKING_PERIOD_RESET_ERROR',
    message: 'Period reset failed for weekly: scheduler offline',
  },
];

describe('Ranking-domain errors (RFC 7807 mapping completeness — Phase 3.2, final module)', () => {
  describe.each(RANKING_CASES)('$name', ({ name, ctor, args, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends RankingDomainError extends BaseDomainException)', () => {
      const instance = make(ctor, ...args);
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(RankingDomainError);
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

  describe('constructor context field', () => {
    // The prior `RankingDomainError` base carried `code` and `context`
    // on the base itself. After Phase 3.2 the `code` field becomes a
    // class-level field (per plan §8.4.2), and the `context` field
    // stays on the concrete classes that pass it. The global filter
    // does NOT expose `context` on the wire (it goes into `extensions`
    // only if explicitly assigned); the field is preserved at
    // runtime for in-process debugging.

    it('InvalidXpEventError.context carries { event }', () => {
      const event = { userId: 'u-1', amount: -5 };
      const instance = new InvalidXpEventError(event, 'Amount must be positive');
      expect(instance.context).toEqual({ event });
    });

    it('InvalidXpEventError.event is public readonly (carried over from prior class)', () => {
      const event = { userId: 'u-1', amount: -5 };
      const instance = new InvalidXpEventError(event, 'Amount must be positive');
      expect(instance.event).toBe(event);
    });

    it('RankCalculationError.context carries { period, ...extras }', () => {
      const instance = new RankCalculationError('daily', 'db deadlock', { userId: 'u-1' });
      expect(instance.context).toEqual({ period: 'daily', userId: 'u-1' });
    });

    it('RankCalculationError.context works without optional extras', () => {
      const instance = new RankCalculationError('daily', 'db deadlock');
      expect(instance.context).toEqual({ period: 'daily' });
    });

    it('PeriodResetError.context carries { period, ...extras }', () => {
      const instance = new PeriodResetError('weekly', 'scheduler offline', { lastReset: 't-1' });
      expect(instance.context).toEqual({ period: 'weekly', lastReset: 't-1' });
    });

    it('PeriodResetError.context works without optional extras', () => {
      const instance = new PeriodResetError('weekly', 'scheduler offline');
      expect(instance.context).toEqual({ period: 'weekly' });
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all ranking exceptions', () => {
      const codes = RANKING_CASES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only RANKING_* codes (no namespace pollution)', () => {
      for (const row of RANKING_CASES) {
        expect(row.expectedCode.startsWith('RANKING_')).toBe(true);
      }
    });

    it('every RANKING_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(RANKING_CASES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('RANKING_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('RankingDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new RankingDomainError(...)`, that file would fail to
      // compile. We also assert below that no RANKING_CASES row points
      // at the abstract class itself.
      expect(typeof RankingDomainError).toBe('function');
      const abstractAsValue: unknown = RankingDomainError;
      expect(
        RANKING_CASES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 3 (matches the design plan; corrected from plan\'s "4 existing codes")', () => {
      // Plan §8.4.2 says "the 4 existing codes translate directly" —
      // that count was stale. The actual count of concrete ranking
      // exceptions is 3 (`InvalidXpEventError`, `RankCalculationError`,
      // `PeriodResetError`). The total-count guard defends against
      // accidental additions/removals.
      expect(RANKING_CASES.length).toBe(3);
    });

    it('counted status-code buckets match the design plan', () => {
      // 3 entries covering 2 status codes:
      //   422: RANKING_INVALID_XP_EVENT (1) — semantic upgrade from
      //        500 catch-all under the prior @Catch() filter
      //   500: RANKING_RANK_CALCULATION_ERROR (1)
      //        RANKING_PERIOD_RESET_ERROR (1)
      // Total = 1 + 1 + 1 = 3.
      const byStatus = RANKING_CASES.reduce<Record<string, string[]>>((acc, row) => {
        const status = String(ProblemCodeMapping[row.expectedCode].status);
        if (!acc[status]) acc[status] = [];
        acc[status].push(row.expectedCode);
        return acc;
      }, {});
      expect(byStatus['422']?.length).toBe(1);
      expect(byStatus['500']?.length).toBe(2);
      expect(Object.values(byStatus).reduce((sum, list) => sum + list.length, 0)).toBe(
        RANKING_CASES.length,
      );
    });

    it('the 500 → 422 status upgrade is exactly as documented (regression guard)', () => {
      // Plan §8.4.2 risk note: status upgrades are wire-shape
      // changes. Capture explicitly so a future mapping change
      // cannot silently regress to 500.
      expect(ProblemCodeMapping['RANKING_INVALID_XP_EVENT'].status).toBe(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    });
  });
});
