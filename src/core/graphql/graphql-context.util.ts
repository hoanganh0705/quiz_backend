/**
 * Execution-context transport discrimination.
 *
 * `context.getType()` is the only reliable signal available before a guard
 * decides how to read its principal: GraphQL reports `'graphql'`, while REST
 * reports `'http'`.
 */
import type { ExecutionContext } from '@nestjs/common';

const GRAPHQL_CONTEXT_TYPE = 'graphql';

export const isGraphQLContext = (context: ExecutionContext): boolean =>
  context.getType<string>() === GRAPHQL_CONTEXT_TYPE;
