import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
  validate,
  type ValidationContext,
} from 'graphql';

import {
  buildComplexityLimitRule,
  buildDepthLimitRule,
  DEFAULT_COMPLEXITY_ESTIMATORS,
} from './graphql-validation.rules';
import { QUERY_TOO_COMPLEX_CODE, QUERY_TOO_DEEP_CODE } from './graphql-error.constants';

/**
 * A schema nested `depth` levels deep, so a query can be built that lands
 * exactly on and exactly over the configured ceiling.
 */
const buildSchema = (depth: number): GraphQLSchema => {
  const leaf = new GraphQLObjectType({
    name: 'Leaf',
    fields: { value: { type: GraphQLString } },
  });

  let current = leaf;
  for (let level = 0; level < depth; level += 1) {
    const child = current;
    current = new GraphQLObjectType({
      name: `Level${level}`,
      fields: { nested: { type: child } },
    });
  }

  return new GraphQLSchema({ query: current });
};

const buildNestedQuery = (depth: number): string => {
  const selection = 'value';
  return `{ ${'nested { '.repeat(depth)}${selection}${'} '.repeat(depth)} }`;
};

const runRule = (schema: GraphQLSchema, query: string, rule: (c: ValidationContext) => unknown) =>
  validate(schema, parse(query), [rule as never]);

describe('buildDepthLimitRule', () => {
  const schema = buildSchema(10);

  it('accepts a query at the depth ceiling', () => {
    const errors = runRule(schema, buildNestedQuery(3), buildDepthLimitRule({ maxDepth: 4 }));

    expect(errors).toHaveLength(0);
  });

  it('rejects a query beyond the depth ceiling', () => {
    const errors = runRule(schema, buildNestedQuery(8), buildDepthLimitRule({ maxDepth: 4 }));

    expect(errors).toHaveLength(1);
  });

  it('tags the violation with QUERY_TOO_DEEP and a 400', () => {
    const [error] = runRule(schema, buildNestedQuery(8), buildDepthLimitRule({ maxDepth: 4 }));

    expect(error.extensions?.code).toBe(QUERY_TOO_DEEP_CODE);
    expect(error.extensions?.status).toBe(400);
  });

  it('keeps the library wording so the client sees a specific message', () => {
    const [error] = runRule(schema, buildNestedQuery(8), buildDepthLimitRule({ maxDepth: 4 }));

    expect(error.message).toContain('depth');
  });
});

describe('buildComplexityLimitRule', () => {
  const schema = buildSchema(3);

  it('accepts a query under the complexity ceiling', () => {
    const errors = runRule(
      schema,
      buildNestedQuery(2),
      buildComplexityLimitRule({
        maximumComplexity: 1000,
        estimators: DEFAULT_COMPLEXITY_ESTIMATORS,
      }),
    );

    expect(errors).toHaveLength(0);
  });

  /**
   * `simpleEstimator` is a factory, so an unscored field is a symptom of
   * passing the factory itself rather than calling it.
   */
  it('scores fields rather than rejecting the query as unscoreable', () => {
    const errors = runRule(
      schema,
      buildNestedQuery(2),
      buildComplexityLimitRule({
        maximumComplexity: 1000,
        estimators: DEFAULT_COMPLEXITY_ESTIMATORS,
      }),
    );

    expect(errors.some((e) => e.message.includes('No complexity could be calculated'))).toBe(false);
  });

  it('rejects a query beyond the complexity ceiling', () => {
    const errors = runRule(
      schema,
      buildNestedQuery(3),
      buildComplexityLimitRule({ maximumComplexity: 2, estimators: DEFAULT_COMPLEXITY_ESTIMATORS }),
    );

    expect(errors).toHaveLength(1);
  });

  it('tags the violation with QUERY_TOO_COMPLEX and a 400', () => {
    const [error] = runRule(
      schema,
      buildNestedQuery(3),
      buildComplexityLimitRule({ maximumComplexity: 2, estimators: DEFAULT_COMPLEXITY_ESTIMATORS }),
    );

    expect(error.extensions?.code).toBe(QUERY_TOO_COMPLEX_CODE);
    expect(error.extensions?.status).toBe(400);
  });

  it('reports the ceiling and the measured cost', () => {
    const [error] = runRule(
      schema,
      buildNestedQuery(3),
      buildComplexityLimitRule({ maximumComplexity: 2, estimators: DEFAULT_COMPLEXITY_ESTIMATORS }),
    );

    expect(error.message).toContain('maximum complexity of 2');
  });

  /**
   * A validation rule shares its context with every other rule, so blanket
   * tagging would relabel unrelated failures and redact their messages.
   */
  it('leaves an unrelated validation failure untagged', () => {
    const errors = validate(schema, parse('{ notAField }'));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.extensions?.code === undefined)).toBe(true);
  });
});

describe('DEFAULT_COMPLEXITY_ESTIMATORS', () => {
  it('is a callable estimator rather than the factory that builds one', () => {
    const [estimator] = DEFAULT_COMPLEXITY_ESTIMATORS;

    expect(typeof estimator).toBe('function');
  });

  it('returns a numeric score for a field', () => {
    const [estimator] = DEFAULT_COMPLEXITY_ESTIMATORS;

    const score = estimator({
      childComplexity: 2,
      args: {},
      field: {} as never,
      node: {} as never,
      type: {} as never,
    });

    expect(typeof score).toBe('number');
    // One point for the field itself plus the two points of its children.
    expect(score).toBe(3);
  });
});
