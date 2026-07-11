/**
 * Transport-side mapping from `BaseDomainException.code` to HTTP metadata.
 *
 * Per the RFC 7807 migration plan (§6.4, §4.4), the HTTP-specific
 * information that turns a domain `code` into a Problem Details response
 * lives in the **transport layer**, not on the domain class. The domain
 * layer carries only `code` (a stable business identifier). The
 * transport layer owns the mapping from that code to `{ status, title,
 * typeUri }`.
 *
 * Sole consumer: `GlobalExceptionFilter`.
 *
 * Adding a new error: declare a `readonly code` on the concrete class
 * (domain-side) AND add the matching entry here (transport-side). The
 * unknown-code loud-failure branch in the global filter means a missing
 * entry surfaces as a 500 + `error: 'unknown_error_code'` log line.
 */
import { HttpStatus } from '@nestjs/common';

interface ProblemCodeInfo {
  readonly status: HttpStatus;
  readonly title: string;
  readonly typeUri: string;
}

export const ProblemCodeMapping: Readonly<Record<string, ProblemCodeInfo>> = {
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
};

const DEFAULT_TYPE_URIS: Readonly<Record<number, string>> = {
  400: 'https://api.quiz.local/problems/bad-request',
  401: 'https://api.quiz.local/problems/unauthorized',
  403: 'https://api.quiz.local/problems/forbidden',
  404: 'https://api.quiz.local/problems/not-found',
  409: 'https://api.quiz.local/problems/conflict',
  422: 'https://api.quiz.local/problems/unprocessable-entity',
  423: 'https://api.quiz.local/problems/locked',
  429: 'https://api.quiz.local/problems/too-many-requests',
  500: 'https://api.quiz.local/problems/internal-server-error',
};

/**
 * Look up the Problem Details metadata for a domain `code`.
 *
 * On hit: returns the entry from `ProblemCodeMapping`.
 * On miss: returns the unknown-code loud-failure branch — a 500 with
 * a generic title and the 500-default type URI. `GlobalExceptionFilter`
 * additionally emits an `error: 'unknown_error_code'` log line so the gap
 * is observable on-call.
 */
export function resolveProblemInfo(code: string): ProblemCodeInfo {
  const entry = ProblemCodeMapping[code];
  if (entry) return entry;
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: DEFAULT_TYPE_URIS[HttpStatus.INTERNAL_SERVER_ERROR] ?? '',
  };
}
