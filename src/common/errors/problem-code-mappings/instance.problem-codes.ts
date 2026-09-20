import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const InstanceProblemCodeMapping = {
  INSTANCE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/instance-not-found',
  },
  INSTANCE_NOT_HOST: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/instance-not-host',
  },
  INSTANCE_NOT_OPEN: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-not-open',
  },
  INSTANCE_FULL: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-full',
  },
  INSTANCE_ALREADY_STARTED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-already-started',
  },
  INSTANCE_ALREADY_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-already-closed',
  },
  INSTANCE_ALREADY_FINISHED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-already-finished',
  },
  PLAYER_ALREADY_JOINED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/player-already-joined',
  },
  INSTANCE_OPTIMISTIC_LOCK: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/instance-optimistic-lock',
  },
  MIN_PLAYERS_NOT_MET: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/min-players-not-met',
  },
  INSTANCE_NOT_IN_COUNTDOWN: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/instance-not-in-countdown',
  },
  INSTANCE_COUNTDOWN_ALREADY_STARTED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/instance-countdown-already-started',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
