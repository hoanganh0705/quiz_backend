import { HttpException, HttpStatus } from '@nestjs/common';
import { GraphQLError } from 'graphql';

import { BaseDomainException } from '@/common/errors/base-domain.exception';
import { GraphQLErrorFormatter } from './graphql-error.formatter';
import {
  INTERNAL_ERROR_CODE,
  INTERNAL_ERROR_MESSAGE,
  QUERY_TOO_COMPLEX_CODE,
  QUERY_TOO_DEEP_CODE,
  RATE_LIMITED_CODE,
} from './graphql-error.constants';

class QuizNotFoundError extends BaseDomainException {
  readonly code = 'QUIZ_NOT_FOUND';
  constructor(quizId: string) {
    super(`Quiz with id '${quizId}' was not found.`);
  }
}

describe('GraphQLErrorFormatter', () => {
  const formatter = new GraphQLErrorFormatter();

  /**
   * Apollo hands `formatError` the formatted error. `GraphQLError.toJSON()`
   * is not a faithful stand-in because it drops `originalError`, which the
   * domain projection depends on, so the shape is built the way Apollo
   * builds it: the located error plus the original attached.
   */
  const format = (error: GraphQLError) =>
    formatter.formatError({
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: error.extensions,
      originalError: error.originalError,
    } as never) as {
      message: string;
      extensions: { code: string; status: number };
    };

  describe('domain errors', () => {
    it('projects a domain code and its mapped status', () => {
      const result = format(
        new GraphQLError('wrapped', { originalError: new QuizNotFoundError('q1') }),
      );

      expect(result.extensions.code).toBe('QUIZ_NOT_FOUND');
      expect(result.extensions.status).toBe(404);
    });

    it('passes the domain message through unchanged', () => {
      const result = format(
        new GraphQLError('wrapped', { originalError: new QuizNotFoundError('q1') }),
      );

      expect(result.message).toBe("Quiz with id 'q1' was not found.");
    });
  });

  describe('transport-classified errors', () => {
    it.each([
      [QUERY_TOO_DEEP_CODE, 400],
      [QUERY_TOO_COMPLEX_CODE, 400],
      [RATE_LIMITED_CODE, 429],
    ])('keeps the %s code the transport assigned', (code, status) => {
      const result = format(new GraphQLError('rejected', { extensions: { code, status } }));

      expect(result.extensions.code).toBe(code);
      expect(result.extensions.status).toBe(status);
    });

    it('preserves a client-safe message that the transport vetted', () => {
      const result = format(
        new GraphQLError('The query exceeds the maximum complexity of 1000.', {
          extensions: { code: QUERY_TOO_COMPLEX_CODE, status: 400 },
        }),
      );

      expect(result.message).toBe('The query exceeds the maximum complexity of 1000.');
    });

    it('keeps an HttpException message, which an operator authored', () => {
      const result = format(
        new GraphQLError('wrapped', {
          originalError: new HttpException('Profile is private', HttpStatus.FORBIDDEN),
          extensions: { code: 'SOME_CODE' },
        }),
      );

      expect(result.message).toBe('Profile is private');
    });
  });

  describe('redaction', () => {
    it('withholds the message of an unexpected throw', () => {
      const result = format(
        new GraphQLError('connect ECONNREFUSED 10.0.0.5:5432', {
          originalError: new Error('connect ECONNREFUSED 10.0.0.5:5432'),
        }),
      );

      expect(result.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(result.extensions.code).toBe(INTERNAL_ERROR_CODE);
      expect(result.extensions.status).toBe(500);
    });

    it('never leaks infrastructure detail in the redacted message', () => {
      const leaky = 'select * from users where password = $1 failed';
      const result = format(new GraphQLError(leaky, { originalError: new Error(leaky) }));

      expect(result.message).not.toContain('password');
      expect(result.message).not.toContain('users');
    });

    /**
     * Apollo stamps this code on every error the application did not classify,
     * so honouring it would both defeat redaction and publish a code spelling
     * this API never emits.
     */
    it('treats the Apollo catch-all code as unclassified', () => {
      const result = format(
        new GraphQLError('connect ECONNREFUSED db:5432', {
          originalError: new Error('connect ECONNREFUSED db:5432'),
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        }),
      );

      expect(result.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(result.extensions.code).toBe(INTERNAL_ERROR_CODE);
    });

    it('redacts an error that carries no extensions at all', () => {
      const result = format(new GraphQLError('raw failure'));

      expect(result.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(result.extensions.code).toBe(INTERNAL_ERROR_CODE);
    });
  });

  describe('extensions', () => {
    it('preserves extensions the transport attached alongside the code', () => {
      const result = format(
        new GraphQLError('rejected', {
          extensions: { code: RATE_LIMITED_CODE, status: 429, http: { status: 429 } },
        }),
      );

      expect(result.extensions).toMatchObject({ code: RATE_LIMITED_CODE, status: 429 });
    });

    it('falls back to 500 when the status is not a valid HTTP status', () => {
      const result = format(
        new GraphQLError('rejected', { extensions: { code: 'SOME_CODE', status: 'nonsense' } }),
      );

      expect(result.extensions.status).toBe(500);
    });
  });
});
