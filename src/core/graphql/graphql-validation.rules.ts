/**
 * Query guard rails.
 *
 * Depth limiting stops a nested selection set from fanning out combinatorially;
 * complexity limiting stops an aliased repetition of a cheap field from
 * costing as much as its fragment count suggests. Both run in the validation
 * phase, so a rejected query costs only parse time and never reaches a
 * resolver.
 *
 * Both libraries report a violation through `ValidationContext.reportError`
 * rather than by throwing, so the problem code is attached to the constructed
 * `GraphQLError` and picked up unchanged by the error formatter.
 */
import { GraphQLError, type ValidationContext } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { createComplexityRule, simpleEstimator } from 'graphql-query-complexity';

import { QUERY_TOO_COMPLEX_CODE, QUERY_TOO_DEEP_CODE } from './graphql-error.constants';
import type { ComplexityEstimator } from 'graphql-query-complexity';

export type DepthLimitConfig = {
  maxDepth: number;
  ignore?: string | RegExp | ((fieldName: string) => boolean);
};

export type ComplexityLimitConfig = {
  maximumComplexity: number;
  estimators: ComplexityEstimator[];
  maxQueryNodes?: number;
};

export const buildDepthLimitRule = (config: DepthLimitConfig) => {
  const validator = depthLimit(config.maxDepth, {
    ignore: config.ignore ?? [String.raw`^__`],
  });

  return (context: ValidationContext): ValidationContext => {
    tagViolations(context, QUERY_TOO_DEEP_CODE, /exceeds maximum operation depth/);
    return validator(context);
  };
};

export const buildComplexityLimitRule = (config: ComplexityLimitConfig) => {
  const rule = createComplexityRule({
    maximumComplexity: config.maximumComplexity,
    estimators: config.estimators,
    maxQueryNodes: config.maxQueryNodes,
    createError: (maximum, actual) =>
      new GraphQLError(
        `The query exceeds the maximum complexity of ${maximum}. Actual complexity is ${actual}`,
        { extensions: { code: QUERY_TOO_COMPLEX_CODE, status: 400 } },
      ),
  });

  return (context: ValidationContext): unknown => {
    tagViolations(
      context,
      QUERY_TOO_COMPLEX_CODE,
      /exceeds the maximum complexity|exceeds the maximum allowed number of nodes|No complexity could be calculated/,
    );
    return rule(context);
  };
};

/**
 * `simpleEstimator` is a factory: calling it returns the estimator that scores
 * every field as one. Passing the factory itself scores nothing, because a
 * factory returns a function rather than a number, so the rule would then
 * reject every query as unscoreable. One point per field is the conservative
 * floor -- a query cannot cost less than the number of fields it selects.
 */
export const DEFAULT_COMPLEXITY_ESTIMATORS: ComplexityEstimator[] = [simpleEstimator()];

/**
 * Introspection is answered from the schema rather than a resolver, so it is
 * exempt from the depth budget. Otherwise tooling such as a client codegen
 * pass would be rejected outright.
 */
export const isIntrospectionField = (name: string): boolean => name.startsWith('__');

/**
 * Tags only the errors this rule recognises, matched on the library's own
 * message wording. Every other error is left untouched: a validation rule
 * shares one `ValidationContext` with the standard rules, so blanket tagging
 * would relabel unrelated failures such as an unknown field and would redact
 * their messages behind the generic internal-error text.
 */
const tagViolations = (
  context: ValidationContext,
  code: string,
  violationPattern: RegExp,
): void => {
  const reportError = context.reportError.bind(context);
  context.reportError = (error: GraphQLError) => {
    if (error.extensions?.code || !violationPattern.test(error.message)) {
      reportError(error);
      return;
    }
    reportError(
      new GraphQLError(error.message, {
        nodes: error.nodes,
        source: error.source,
        positions: error.positions,
        path: error.path,
        originalError: error.originalError,
        extensions: { ...error.extensions, code, status: 400 },
      }),
    );
  };
};
