import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  TournamentAlreadyRegisteredError,
  TournamentAlreadyWithdrawnError,
  TournamentAttemptAlreadyExistsError,
  TournamentConflictError,
  TournamentDomainError,
  TournamentForbiddenError,
  TournamentFullError,
  TournamentNotFoundError,
  TournamentNotRegisteredError,
  TournamentParticipantStateError,
  TournamentRegistrationClosedError,
  TournamentRoundNotFoundError,
  TournamentRoundNotOpenError,
  TournamentUnregisterClosedError,
  TournamentValidationError,
  TournamentWithdrawClosedError,
} from './tournament-domain.errors';

const TOURNAMENT_CODES: ReadonlyArray<{
  readonly name: string;
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'TournamentNotFoundError',
    ctor: TournamentNotFoundError,
    expectedCode: 'TOURNAMENT_NOT_FOUND',
    message: 'Tournament not found',
  },
  {
    name: 'TournamentRoundNotFoundError',
    ctor: TournamentRoundNotFoundError,
    expectedCode: 'TOURNAMENT_ROUND_NOT_FOUND',
    message: 'Tournament round not found',
  },
  {
    name: 'TournamentNotRegisteredError',
    ctor: TournamentNotRegisteredError,
    expectedCode: 'TOURNAMENT_NOT_REGISTERED',
    message: 'You are not registered for this tournament',
  },
  {
    name: 'TournamentForbiddenError',
    ctor: TournamentForbiddenError,
    expectedCode: 'TOURNAMENT_FORBIDDEN',
    message: 'You do not have permission to manage this tournament',
  },
  {
    name: 'TournamentConflictError',
    ctor: TournamentConflictError,
    expectedCode: 'TOURNAMENT_CONFLICT',
    message: 'Resource conflict',
  },
  {
    name: 'TournamentAlreadyRegisteredError',
    ctor: TournamentAlreadyRegisteredError,
    expectedCode: 'TOURNAMENT_ALREADY_REGISTERED',
    message: 'You are already registered for this tournament',
  },
  {
    name: 'TournamentAttemptAlreadyExistsError',
    ctor: TournamentAttemptAlreadyExistsError,
    expectedCode: 'TOURNAMENT_ATTEMPT_ALREADY_EXISTS',
    message: 'You have already submitted an attempt for this round',
  },
  {
    name: 'TournamentAlreadyWithdrawnError',
    ctor: TournamentAlreadyWithdrawnError,
    expectedCode: 'TOURNAMENT_ALREADY_WITHDRAWN',
    message: 'You have already withdrawn from this tournament',
  },
  {
    name: 'TournamentValidationError',
    ctor: TournamentValidationError,
    expectedCode: 'TOURNAMENT_VALIDATION',
    message: 'Validation failed',
  },
  {
    name: 'TournamentRegistrationClosedError',
    ctor: TournamentRegistrationClosedError,
    expectedCode: 'TOURNAMENT_REGISTRATION_CLOSED',
    message: 'Tournament registration is closed',
  },
  {
    name: 'TournamentFullError',
    ctor: TournamentFullError,
    expectedCode: 'TOURNAMENT_FULL',
    message: 'Tournament is full',
  },
  {
    name: 'TournamentRoundNotOpenError',
    ctor: TournamentRoundNotOpenError,
    expectedCode: 'TOURNAMENT_ROUND_NOT_OPEN',
    message: 'Tournament round is not open',
  },
  {
    name: 'TournamentUnregisterClosedError',
    ctor: TournamentUnregisterClosedError,
    expectedCode: 'TOURNAMENT_UNREGISTER_CLOSED',
    message: 'You can only unregister from an upcoming or registration-phase tournament',
  },
  {
    name: 'TournamentWithdrawClosedError',
    ctor: TournamentWithdrawClosedError,
    expectedCode: 'TOURNAMENT_WITHDRAW_CLOSED',
    message: 'Tournament withdrawal is only allowed while the tournament is active',
  },
];

describe('Tournament-domain errors (RFC 7807 mapping completeness — Phase 2)', () => {
  describe.each(TOURNAMENT_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends TournamentDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(TournamentDomainError);
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

  describe('TournamentParticipantStateError (required-arg ctor exception)', () => {
    it('is a BaseDomainException subclass (extends TournamentDomainError extends BaseDomainException)', () => {
      const instance = new TournamentParticipantStateError('specific state');
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(TournamentDomainError);
    });

    it("declares `code = 'TOURNAMENT_PARTICIPANT_STATE'`", () => {
      const instance = new TournamentParticipantStateError('specific state');
      expect(instance.code).toBe('TOURNAMENT_PARTICIPANT_STATE');
    });

    it("'TOURNAMENT_PARTICIPANT_STATE' resolves in ProblemCodeMapping", () => {
      expect(
        Object.prototype.hasOwnProperty.call(ProblemCodeMapping, 'TOURNAMENT_PARTICIPANT_STATE'),
      ).toBe(true);
    });

    it('preserves the thrown message verbatim (no useful default for this exception)', () => {
      const instance = new TournamentParticipantStateError(
        'Participant is in unexpected state "withdrawn" for this operation',
      );
      expect(instance.message).toBe(
        'Participant is in unexpected state "withdrawn" for this operation',
      );
    });

    it("sets `name` to 'TournamentParticipantStateError' (for log paths)", () => {
      const instance = new TournamentParticipantStateError('specific state');
      expect(instance.name).toBe('TournamentParticipantStateError');
    });
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all tournament exceptions', () => {
      const codes = [
        ...TOURNAMENT_CODES.map((row) => row.expectedCode),
        'TOURNAMENT_PARTICIPANT_STATE',
      ];
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only TOURNAMENT_* codes (no namespace pollution)', () => {
      const allCodes = [
        ...TOURNAMENT_CODES.map((row) => row.expectedCode),
        'TOURNAMENT_PARTICIPANT_STATE',
      ];
      for (const code of allCodes) {
        expect(code.startsWith('TOURNAMENT_')).toBe(true);
      }
    });

    it('every TOURNAMENT_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set([
        ...TOURNAMENT_CODES.map((row) => row.expectedCode),
        'TOURNAMENT_PARTICIPANT_STATE',
      ]);
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('TOURNAMENT_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });

    it('TournamentDomainError is declared `abstract` at the TypeScript level (compile-time guard)', () => {
      // JavaScript runtime does not enforce `abstract` — it is a
      // compile-time-only TypeScript check. The strongest runtime-level
      // assertion is to verify the constructor itself is defined (the
      // class compiles to a real constructor). The compile-time guard
      // is implicitly tested by `tsc --noEmit` passing — if any caller
      // wrote `new TournamentDomainError(...)`, that file would fail to
      // compile. We also assert below that no TOURNAMENT_CODES row
      // points at the abstract class itself.
      expect(typeof TournamentDomainError).toBe('function');
      const abstractAsValue: unknown = TournamentDomainError;
      expect(
        TOURNAMENT_CODES.find((row) => (row.ctor as unknown) === abstractAsValue),
      ).toBeUndefined();
    });

    it('total exception count is 15 (matches the design plan)', () => {
      // This guards against accidental additions/removals during
      // refactors. The 15 count includes the 14 in TOURNAMENT_CODES
      // plus TournamentParticipantStateError (required-arg ctor).
      const total = TOURNAMENT_CODES.length + 1; // +1 for TournamentParticipantStateError
      expect(total).toBe(15);
    });
  });
});
