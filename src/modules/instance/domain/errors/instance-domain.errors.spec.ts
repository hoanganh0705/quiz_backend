import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  InstanceAlreadyClosedError,
  InstanceAlreadyFinishedError,
  InstanceAlreadyStartedError,
  InstanceCountdownAlreadyStartedError,
  InstanceDomainError,
  InstanceFullError,
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotInCountdownError,
  InstanceNotOpenError,
  InstanceOptimisticLockError,
  MinPlayersNotMetError,
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
    name: 'InstanceAlreadyFinishedError',
    ctor: InstanceAlreadyFinishedError,
    expectedCode: 'INSTANCE_ALREADY_FINISHED',
    message: 'Instance is finished',
  },
  {
    name: 'PlayerAlreadyJoinedError',
    ctor: PlayerAlreadyJoinedError,
    expectedCode: 'PLAYER_ALREADY_JOINED',
    message: 'You have already joined this instance',
  },
  {
    name: 'InstanceOptimisticLockError',
    ctor: InstanceOptimisticLockError,
    expectedCode: 'INSTANCE_OPTIMISTIC_LOCK',
    message: 'Instance was modified concurrently — please retry the operation',
  },
  {
    name: 'MinPlayersNotMetError',
    ctor: MinPlayersNotMetError,
    expectedCode: 'MIN_PLAYERS_NOT_MET',
    message: 'Instance requires at least 2 players before the host can start the countdown',
  },
  {
    name: 'InstanceNotInCountdownError',
    ctor: InstanceNotInCountdownError,
    expectedCode: 'INSTANCE_NOT_IN_COUNTDOWN',
    message: 'Instance is not in the countdown state',
  },
  {
    name: 'InstanceCountdownAlreadyStartedError',
    ctor: InstanceCountdownAlreadyStartedError,
    expectedCode: 'INSTANCE_COUNTDOWN_ALREADY_STARTED',
    message: 'Countdown has already started for this instance',
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

    it('declares only INSTANCE_* / PLAYER_* / MIN_* codes (no namespace pollution)', () => {
      // Phase 2 (Gameplay Lifecycle): `MIN_PLAYERS_NOT_MET` is intentionally
      // not prefixed with `INSTANCE_` because the code reads as a business
      // predicate ("the multiplayer precondition was violated"), not as
      // an instance-state machine error. It still belongs to this module.
      for (const row of INSTANCE_CODES) {
        const code = row.expectedCode;
        const isInstance = code.startsWith('INSTANCE_');
        const isPlayer = code.startsWith('PLAYER_');
        const isMin = code.startsWith('MIN_');
        expect(isInstance || isPlayer || isMin).toBe(true);
      }
    });

    it('every INSTANCE_* / PLAYER_* / MIN_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(INSTANCE_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter(
        (k) => k.startsWith('INSTANCE_') || k.startsWith('PLAYER_') || k.startsWith('MIN_'),
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

    it('total exception count is 12 (Phase 1: +1 optimistic-lock; Phase 2: +3 countdown lifecycle)', () => {
      // Phase 1 (Foundational Correctness) added `InstanceOptimisticLockError`,
      // bringing the total from 8 to 9. Phase 2 (Gameplay Lifecycle) added
      // `MinPlayersNotMetError`, `InstanceNotInCountdownError`, and
      // `InstanceCountdownAlreadyStartedError`, bringing the total to 12.
      // Counts must change explicitly here so an accidental add/remove
      // shows up in this test.
      expect(INSTANCE_CODES.length).toBe(12);
    });
  });

  describe('Phase 2/3 wiring sanity', () => {
    it('PLAYER_ALREADY_JOINED is mapped to 409 Conflict in ProblemCodeMapping', () => {
      // Phase 2 (issue 5.1): the duplicate-join path is now thrown and
      // must surface as 409. The previous mapping to 400 was the wire
      // shape bug audit issue 5.1 fixed.
      expect(ProblemCodeMapping.PLAYER_ALREADY_JOINED.status).toBe(409);
    });

    it('INSTANCE_ALREADY_FINISHED is mapped to 400 BadRequest in ProblemCodeMapping', () => {
      // Phase 3 (issue 7.1): added a distinct entry for the terminal
      // `finished` state. Same status as `INSTANCE_ALREADY_CLOSED` (400)
      // but a different `typeUri`.
      expect(ProblemCodeMapping.INSTANCE_ALREADY_FINISHED.status).toBe(400);
      expect(ProblemCodeMapping.INSTANCE_ALREADY_FINISHED.typeUri).not.toBe(
        ProblemCodeMapping.INSTANCE_ALREADY_CLOSED.typeUri,
      );
    });

    it('INSTANCE_OPTIMISTIC_LOCK is mapped to 409 Conflict in ProblemCodeMapping', () => {
      // Phase 1 (Foundational Correctness): the optimistic-locking
      // protocol surfaces as a 409 so clients know they must re-read
      // and decide whether to retry. Same status as PLAYER_ALREADY_JOINED
      // but a distinct `typeUri` (clients dispatch on `extensions.code`).
      expect(ProblemCodeMapping.INSTANCE_OPTIMISTIC_LOCK.status).toBe(409);
      expect(ProblemCodeMapping.INSTANCE_OPTIMISTIC_LOCK.typeUri).not.toBe(
        ProblemCodeMapping.PLAYER_ALREADY_JOINED.typeUri,
      );
    });

    it('MIN_PLAYERS_NOT_MET is mapped to 422 UnprocessableEntity in ProblemCodeMapping', () => {
      // Phase 2 (Gameplay Lifecycle): the multiplayer-only precondition
      // is a state-rejection, not a malformed-request 400. 422 says
      // "the request is well-formed but the current server-side state
      // rejects it" — the canonical mapping for capacity-style gates.
      expect(ProblemCodeMapping.MIN_PLAYERS_NOT_MET.status).toBe(422);
    });

    it('INSTANCE_NOT_IN_COUNTDOWN is mapped to 409 Conflict in ProblemCodeMapping', () => {
      // Phase 2 (Gameplay Lifecycle): cancelCountdown and startInstance
      // (when the host skipped the countdown) both surface this. Same
      // status as `INSTANCE_OPTIMISTIC_LOCK` (409) but distinct `typeUri`.
      expect(ProblemCodeMapping.INSTANCE_NOT_IN_COUNTDOWN.status).toBe(409);
      expect(ProblemCodeMapping.INSTANCE_NOT_IN_COUNTDOWN.typeUri).not.toBe(
        ProblemCodeMapping.INSTANCE_OPTIMISTIC_LOCK.typeUri,
      );
    });

    it('INSTANCE_COUNTDOWN_ALREADY_STARTED is mapped to 409 Conflict in ProblemCodeMapping', () => {
      // Phase 2 (Gameplay Lifecycle): the natural idempotency guard
      // on a duplicate `startCountdown` call. Same status as
      // `INSTANCE_OPTIMISTIC_LOCK` (409) but distinct `typeUri`; the
      // controller catches this and folds it into a 200 with the
      // existing anchor.
      expect(ProblemCodeMapping.INSTANCE_COUNTDOWN_ALREADY_STARTED.status).toBe(409);
      expect(ProblemCodeMapping.INSTANCE_COUNTDOWN_ALREADY_STARTED.typeUri).not.toBe(
        ProblemCodeMapping.INSTANCE_NOT_IN_COUNTDOWN.typeUri,
      );
    });
  });
});
