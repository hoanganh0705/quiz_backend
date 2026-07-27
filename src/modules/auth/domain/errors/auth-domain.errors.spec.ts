import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  AuthDomainError,
  DeletionFailedError,
  InvalidCredentialsError,
  InvalidPasswordError,
  InvalidRefreshTokenError,
  InvalidTokenError,
  PasswordReuseError,
  RateLimitExceededError,
  ResourceConflictError,
  SessionContextMismatchError,
  SessionNotFoundError,
  TokenReuseDetectedError,
  UserNotFoundError,
} from './auth-domain.errors';
import {
  InvalidOAuthTokenError,
  OAuthAccountAlreadyExistsError,
  OAuthAccountLinkingRequiredError,
} from '../oauth/errors';

/**
 * Every concrete auth-module exception class plus the expected `code` it
 * declares. The test iterates this table and asserts three things per row:
 *   1. The class extends `BaseDomainException` (compile-time + runtime).
 *   2. The class's `code` field is a non-empty string.
 *   3. The `code` resolves in `ProblemCodeMapping`.
 *
 * Adding a new exception? Add a row here. The unknown-code loud-failure
 * branch in `GlobalExceptionFilter` plus this spec together ensure no
 * exception ships without a mapping entry.
 */
const AUTH_CODES: ReadonlyArray<{
  readonly name: string;
  // ctor may accept a custom message override, or no arguments at all
  // (for the OAuth exceptions whose messages are fixed at the class level).
  // The `string | undefined` parameter type covers both: `new Ctor()` is
  // valid (omitted arg = undefined) and `new Ctor('foo')` is also valid.
  readonly ctor: new (message?: string) => BaseDomainException;
  readonly expectedCode: string;
  readonly message: string;
}> = [
  {
    name: 'InvalidCredentialsError',
    ctor: InvalidCredentialsError,
    expectedCode: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
  {
    name: 'InvalidRefreshTokenError',
    ctor: InvalidRefreshTokenError,
    expectedCode: 'AUTH_INVALID_REFRESH_TOKEN',
    message: 'Invalid or expired refresh token',
  },
  {
    name: 'TokenReuseDetectedError',
    ctor: TokenReuseDetectedError,
    expectedCode: 'AUTH_TOKEN_REUSED',
    message: 'Security action taken on your account. Please log in again.',
  },
  {
    name: 'SessionContextMismatchError',
    ctor: SessionContextMismatchError,
    expectedCode: 'AUTH_SESSION_CONTEXT_MISMATCH',
    message: 'Session context mismatch',
  },
  {
    name: 'UserNotFoundError',
    ctor: UserNotFoundError,
    expectedCode: 'AUTH_USER_NOT_FOUND',
    message: 'User not found',
  },
  {
    name: 'RateLimitExceededError',
    ctor: RateLimitExceededError,
    expectedCode: 'AUTH_RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
  },
  {
    name: 'ResourceConflictError',
    ctor: ResourceConflictError,
    expectedCode: 'AUTH_RESOURCE_CONFLICT',
    message: 'Resource conflict',
  },
  {
    name: 'SessionNotFoundError',
    ctor: SessionNotFoundError,
    expectedCode: 'AUTH_SESSION_NOT_FOUND',
    message: 'Session not found',
  },
  {
    name: 'InvalidTokenError',
    ctor: InvalidTokenError,
    expectedCode: 'AUTH_INVALID_TOKEN',
    message: 'Invalid or expired token',
  },
  {
    name: 'InvalidPasswordError',
    ctor: InvalidPasswordError,
    expectedCode: 'AUTH_INVALID_CURRENT_PASSWORD',
    message: 'Invalid current password',
  },
  {
    name: 'DeletionFailedError',
    ctor: DeletionFailedError,
    expectedCode: 'AUTH_DELETION_FAILED',
    message: 'Account deletion failed',
  },
  {
    name: 'PasswordReuseError',
    ctor: PasswordReuseError,
    expectedCode: 'AUTH_PASSWORD_REUSE',
    message: 'Password has been used recently. Please choose a different password.',
  },
  {
    name: 'InvalidOAuthTokenError',
    ctor: InvalidOAuthTokenError,
    expectedCode: 'AUTH_OAUTH_INVALID_TOKEN',
    message: 'Invalid or expired OAuth credentials',
  },
  {
    name: 'OAuthAccountAlreadyExistsError',
    ctor: OAuthAccountAlreadyExistsError,
    expectedCode: 'AUTH_OAUTH_ACCOUNT_ALREADY_EXISTS',
    message: 'OAuth account link already exists',
  },
  {
    name: 'OAuthAccountLinkingRequiredError',
    ctor: OAuthAccountLinkingRequiredError,
    expectedCode: 'AUTH_OAUTH_LINKING_REQUIRED',
    message:
      'Account linking requires explicit confirmation because the existing account is not verified.',
  },
];

describe('Auth-domain errors (RFC 7807 mapping completeness)', () => {
  describe.each(AUTH_CODES)('$name', ({ name, ctor, expectedCode, message }) => {
    it('is a BaseDomainException subclass (extends AuthDomainError extends BaseDomainException)', () => {
      const instance = new ctor();
      expect(instance).toBeInstanceOf(BaseDomainException);
      expect(instance).toBeInstanceOf(AuthDomainError);
    });

    it(`declares \`code = '${expectedCode}'\``, () => {
      const instance = new ctor();
      expect(instance.code).toBe(expectedCode);
    });

    it(`'${expectedCode}' resolves in ProblemCodeMapping`, () => {
      expect(Object.prototype.hasOwnProperty.call(ProblemCodeMapping, expectedCode)).toBe(true);
    });

    it(`preserves the default message verbatim (no filtering on the wire)`, () => {
      const instance = new ctor();
      expect(instance.message).toBe(message);
    });

    it(`sets \`name\` to the concrete class name (for log paths)`, () => {
      const instance = new ctor();
      expect(instance.name).toBe(name);
    });

    // OAuthAccountAlreadyExistsError and OAuthAccountLinkingRequiredError
    // declare no constructor parameter — their message is fixed at the
    // class level. Skip the override-acceptance assertion for those.
    if (ctor.length > 0) {
      it(`accepts a custom message override`, () => {
        const instance = new ctor('custom override');
        expect(instance.message).toBe('custom override');
        // `code` is class-level and unaffected by message.
        expect(instance.code).toBe(expectedCode);
      });
    }
  });

  describe('aggregate invariants', () => {
    it('declares unique codes across all auth exceptions', () => {
      const codes = AUTH_CODES.map((row) => row.expectedCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('declares only AUTH_* codes (no namespace pollution)', () => {
      for (const row of AUTH_CODES) {
        expect(row.expectedCode.startsWith('AUTH_')).toBe(true);
      }
    });

    it('every AUTH_* code in ProblemCodeMapping is declared by exactly one exception class', () => {
      const declared = new Set(AUTH_CODES.map((row) => row.expectedCode));
      const mapped = Object.keys(ProblemCodeMapping).filter((k) => k.startsWith('AUTH_'));
      for (const code of mapped) {
        expect(declared.has(code)).toBe(true);
      }
    });
  });
});
