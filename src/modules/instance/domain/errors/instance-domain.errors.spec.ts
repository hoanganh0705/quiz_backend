import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  InstanceAlreadyClosedError,
  InstanceAlreadyStartedError,
  InstanceDomainError,
  InstanceFullError,
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  PlayerAlreadyJoinedError,
} from './instance-domain.errors';

const INSTANCE_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'InstanceNotFoundError',
    ctor: InstanceNotFoundError,
    expectedCode: 'INSTANCE_NOT_FOUND',
    message: 'Quiz instance not found',
  },
  {
    name: 'InstanceNotHostError',
    ctor: InstanceNotHostError,
    expectedCode: 'INSTANCE_NOT_HOST',
    message: 'Only the host can perform this action',
  },
  {
    name: 'InstanceNotOpenError',
    ctor: InstanceNotOpenError,
    expectedCode: 'INSTANCE_NOT_OPEN',
    message: 'Instance is not open for joining',
  },
  {
    name: 'InstanceFullError',
    ctor: InstanceFullError,
    expectedCode: 'INSTANCE_FULL',
    message: 'Instance is full',
  },
  {
    name: 'InstanceAlreadyStartedError',
    ctor: InstanceAlreadyStartedError,
    expectedCode: 'INSTANCE_ALREADY_STARTED',
    message: 'Instance has already started',
  },
  {
    name: 'InstanceAlreadyClosedError',
    ctor: InstanceAlreadyClosedError,
    expectedCode: 'INSTANCE_ALREADY_CLOSED',
    message: 'Instance is already closed',
  },
  {
    name: 'PlayerAlreadyJoinedError',
    ctor: PlayerAlreadyJoinedError,
    expectedCode: 'PLAYER_ALREADY_JOINED',
    message: 'You have already joined this instance',
  },
];

describe('Instance-domain errors (RFC 7807 mapping completeness — Phase 2)', () => {
  describe.each(INSTANCE_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends InstanceDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(InstanceDomainError);
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
    it('declares unique codes across all instance exceptions', () => {
      const codes = INSTANCE_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only INSTANCE_* or PLAYER_* codes (no namespace pollution)', () => {
      for (const row of INSTANCE_CODES) {
        const code = row.expectedCode;
        const isInstance = code.startsWith('INSTANCE_');
        const isPlayer = code.startsWith('PLAYER_');
        expect(isInstance || isPlayer).toBe(true);
      }
    });

    it('every INSTANCE_* or PLAYER_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(INSTANCE_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter(
        (k) => k.startsWith('INSTANCE_') || k.startsWith('PLAYER_'),
      );
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('InstanceDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new InstanceDomainError(...)`, that file would fail to
      // compile. We also assert below that no INSTANCE_CODES row
      // points at the abstract class itself.
      expect(typeof InstanceDomainError).toBe('function');
      const abstractAsValue: unknown = InstanceDomainError;
      expect(
        INSTANCE_CODES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 7 (matches the design plan)', () => {
      // This guards against accidental additions/removals during
      // refactors.
      expect(INSTANCE_CODES.length).toBe(7);
    });
  });
});
