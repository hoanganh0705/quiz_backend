import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const AuthProblemCodeMapping = {
  // ===========================================================================
  // AUTH module — src/modules/auth/domain/errors/auth-domain.errors.ts
  //   src/modules/auth/domain/oauth/errors.ts
  // ===========================================================================
  AUTH_INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-credentials',
  },
  AUTH_INVALID_REFRESH_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-refresh-token',
  },
  AUTH_TOKEN_REUSED: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-token-reused',
  },
  AUTH_SESSION_CONTEXT_MISMATCH: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-session-context-mismatch',
  },
  AUTH_USER_NOT_FOUND: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-user-not-found',
  },
  AUTH_RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    title: 'TooManyRequests',
    typeUri: 'https://api.quiz.local/problems/auth-rate-limited',
  },
  AUTH_RESOURCE_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-resource-conflict',
  },
  AUTH_SESSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/auth-session-not-found',
  },
  AUTH_INVALID_TOKEN: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-token',
  },
  AUTH_INVALID_CURRENT_PASSWORD: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-current-password',
  },
  AUTH_DELETION_FAILED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-deletion-failed',
  },
  AUTH_PASSWORD_REUSE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-password-reuse',
  },
  AUTH_OAUTH_INVALID_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-oauth-invalid-token',
  },
  AUTH_OAUTH_ACCOUNT_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-oauth-account-already-exists',
  },
  AUTH_OAUTH_LINKING_REQUIRED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-oauth-linking-required',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
