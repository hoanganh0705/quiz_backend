import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const TournamentProblemCodeMapping = {
  TOURNAMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tournament-not-found',
  },
  TOURNAMENT_ROUND_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tournament-round-not-found',
  },
  TOURNAMENT_NOT_REGISTERED: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tournament-not-registered',
  },
  TOURNAMENT_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/tournament-forbidden',
  },
  TOURNAMENT_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-conflict',
  },
  TOURNAMENT_ALREADY_REGISTERED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-already-registered',
  },
  TOURNAMENT_ATTEMPT_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-attempt-already-exists',
  },
  TOURNAMENT_PARTICIPANT_STATE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-participant-state',
  },
  TOURNAMENT_ALREADY_WITHDRAWN: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-already-withdrawn',
  },
  TOURNAMENT_VALIDATION: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-validation',
  },
  TOURNAMENT_REGISTRATION_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-registration-closed',
  },
  TOURNAMENT_FULL: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-full',
  },
  TOURNAMENT_ROUND_NOT_OPEN: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-round-not-open',
  },
  TOURNAMENT_UNREGISTER_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-unregister-closed',
  },
  TOURNAMENT_WITHDRAW_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-withdraw-closed',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
