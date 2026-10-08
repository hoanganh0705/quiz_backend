/**
 * GraphQL error formatting.
 *
 * Domain failures surface as `BaseDomainException` subclasses carrying a
 * stable `code`. This formatter projects that code into `extensions` so
 * clients branch on a machine-readable identifier instead of parsing
 * human-readable messages.
 *
 * Unexpected failures are redacted before they leave the process: the client
 * receives a generic message while the specific detail stays in the logs.
 */
import { Injectable } from '@nestjs/common';
import { GraphQLFormattedError, GraphQLError } from 'graphql';

import { BaseDomainException } from '@/common/errors/base-domain.exception';
import { resolveProblemInfo } from '@/common/errors/problem-code-mapping';
import {
  INTERNAL_ERROR_CODE,
  INTERNAL_ERROR_MESSAGE,
  UNCLASSIFIED_TRANSPORT_CODE,
  isSafeClientMessage,
  statusFromExtension,
} from './graphql-error.constants';

type ResolvedProblem = {
  code: string;
  status: number;
  message: string;
};

export type FormattedGraphQLError = GraphQLFormattedError & {
  extensions: NonNullable<GraphQLFormattedError['extensions']> & {
    code: string;
    status: number;
  };
};

@Injectable()
export class GraphQLErrorFormatter {
  formatError(error: GraphQLFormattedError): FormattedGraphQLError {
    const problem = this.resolveProblem(error);
    const extensions = error.extensions ?? {};

    return {
      ...error,
      message: problem.message,
      extensions: {
        ...extensions,
        code: problem.code,
        status: problem.status,
      },
    };
  }

  private resolveProblem(error: GraphQLFormattedError): ResolvedProblem {
    const originalError = readOriginalError(error);
    const transportProblem = this.fromTransportException(originalError, error);
    if (transportProblem) return transportProblem;

    return {
      code: INTERNAL_ERROR_CODE,
      status: 500,
      message: INTERNAL_ERROR_MESSAGE,
    };
  }

  /**
   * Recognise failures the transport already annotated with a problem code,
   * which is how the validation rules and Apollo's own error classes surface.
   */
  private fromTransportException(
    originalError: unknown,
    error: GraphQLFormattedError,
  ): ResolvedProblem | null {
    if (originalError instanceof BaseDomainException) {
      const info = resolveProblemInfo(originalError.code);
      return { code: originalError.code, status: info.status, message: originalError.message };
    }

    const code = this.readStringExtension(error.extensions, 'code');
    if (!code || code === UNCLASSIFIED_TRANSPORT_CODE) return null;

    return {
      code,
      status: statusFromExtension(error.extensions?.status),
      message: this.resolveClientMessage(originalError, error),
    };
  }

  /**
   * A code in `extensions` means the transport already classified the failure
   * and vetted the message for the client, so the formatted message is
   * returned as is. Without a code the error is an unexpected throw, whose
   * message may embed a SQL fragment or an upstream payload, and is replaced
   * with a generic string.
   */
  private resolveClientMessage(originalError: unknown, error: GraphQLFormattedError): string {
    if (isSafeClientMessage(originalError)) return this.extractSafeMessage(originalError);
    return error.message || INTERNAL_ERROR_MESSAGE;
  }

  private extractSafeMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return INTERNAL_ERROR_MESSAGE;
  }

  private readStringExtension(
    extensions: GraphQLFormattedError['extensions'],
    key: string,
  ): string | undefined {
    const value = extensions?.[key];
    return typeof value === 'string' ? value : undefined;
  }
}

/**
 * Apollo's `formatError` hook receives the formatted shape, which drops
 * `originalError` from the published typings even though the runtime value
 * still carries it. Reading it through a narrow cast keeps the domain error
 * identity that the projection depends on.
 */
const readOriginalError = (error: GraphQLFormattedError): unknown =>
  (error as { originalError?: unknown }).originalError;

/**
 * Re-exported so validation rules can construct a `GraphQLError` that the
 * formatter recognises, keeping the projection in one place.
 */
export const problemGraphQLError = (code: string, message: string, status: number): GraphQLError =>
  new GraphQLError(message, {
    extensions: { code, status },
  });
