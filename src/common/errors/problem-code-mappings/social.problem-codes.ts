import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const SocialProblemCodeMapping = {
  SOCIAL_FRIEND_REQUEST_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-friend-request-not-found',
  },
  SOCIAL_FRIEND_REQUEST_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-friend-request-forbidden',
  },
  SOCIAL_FRIEND_LIST_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-friend-list-forbidden',
  },
  SOCIAL_SELF_FRIEND_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/social-self-friend-request',
  },
  SOCIAL_ALREADY_FRIENDS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/social-already-friends',
  },
  SOCIAL_BLOCKED_USER: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-blocked-user',
  },
  SOCIAL_USER_BLOCKED: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-user-blocked',
  },
  SOCIAL_PENDING_REQUEST_EXISTS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/social-pending-request-exists',
  },
  SOCIAL_FRIENDSHIP_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-friendship-not-found',
  },
  SOCIAL_USER_NOT_BLOCKED: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-user-not-blocked',
  },
  SOCIAL_FOLLOW_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-follow-not-found',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
