/**
 * GraphQL error presentation constants.
 */
import { HttpException, HttpStatus } from '@nestjs/common';

import { BaseDomainException } from '@/common/errors/base-domain.exception';

/** Code attached to failures that carry no recognisable domain identity. */
export const INTERNAL_ERROR_CODE = 'GRAPHQL_INTERNAL_ERROR';

/**
 * Apollo Server stamps this code on any error a resolver threw that the
 * application did not classify itself. Treating it as a meaningful code would
 * both defeat the redaction below and hand the client a spelling the rest of
 * this API never emits, so it is explicitly ignored.
 */
export const UNCLASSIFIED_TRANSPORT_CODE = 'INTERNAL_SERVER_ERROR';

/** Client-safe stand-in for an unexpected failure. */
export const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred.';

/**
 * Codes raised by the query guard rails. Kept here so the validation rules,
 * the formatter, and the e2e assertions all reference one spelling.
 */
export const QUERY_TOO_DEEP_CODE = 'QUERY_TOO_DEEP';
export const QUERY_TOO_COMPLEX_CODE = 'QUERY_TOO_COMPLEX';

/** Code attached to an operation rejected by the endpoint rate limiter. */
export const RATE_LIMITED_CODE = 'RATE_LIMITED';
export const RATE_LIMITED_MESSAGE = 'Too many requests. Please retry shortly.';

/**
 * A failure is client-safe when the transport or the domain layer authored its
 * message deliberately.
 *
 * `HttpException` carries an operator-authored string. `BaseDomainException`
 * carries a stable business identifier. Everything else is an unexpected
 * throw whose message may embed a SQL fragment, a file path, or an upstream
 * payload, so the message is withheld. The check intentionally keys off the
 * concrete class rather than a duck-typed `code` property, because infrastructure
 * errors (Postgres in particular) also expose `code` while their messages leak
 * schema and constraint detail.
 */
export const isSafeClientMessage = (error: unknown): boolean =>
  error instanceof HttpException || error instanceof BaseDomainException;

export const statusFromExtension = (status: unknown): number =>
  typeof status === 'number' && status >= 400 && status <= 599
    ? status
    : HttpStatus.INTERNAL_SERVER_ERROR;
