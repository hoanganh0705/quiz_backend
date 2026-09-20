import type { SessionRequestContext } from '../../types/auth-context.types';

/**
 * Snapshot of the per-request cookie instructions. Produced exactly
 * once at the end of the auth flow and consumed by the
 * `RefreshTokenInterceptor` to mutate the response. Marking every
 * field `readonly` (and the object itself `Readonly<...>`) prevents
 * downstream interceptors from mutating the snapshot between
 * controller completion and response commit, which would otherwise
 * be a silent bug: e.g. a 401 produced by an exception filter could
 * accidentally clear the cookie set by a successful refresh path
 * if the snapshot were shared by reference.
 */
export type AuthCookieInstructions = {
  readonly refreshToken?: string;
  readonly clearRefreshToken?: boolean;
};

/**
 * Per-request context built by the auth request-context middleware
 * (see `auth-request-context.middleware.ts`) and exposed to auth
 * controller handlers. The mutators (`setRefreshToken`,
 * `clearRefreshToken`) update an internal closure state but the
 * externally observable `getCookieInstructions()` always returns a
 * fresh `Readonly<AuthCookieInstructions>` so callers cannot mutate
 * it from outside the request scope.
 */
export type AuthRequestContext = {
  session: SessionRequestContext;
  setRefreshToken: (token: string) => void;
  clearRefreshToken: () => void;
  getCookieInstructions: () => Readonly<AuthCookieInstructions>;
};
