/**
 * GraphQL server configuration.
 *
 * Query depth and complexity ceilings keep a single request from consuming
 * disproportionate server work. Both are exposed as environment variables so
 * a deployment can tighten them without a code change.
 */
import { ConfigType, registerAs } from '@nestjs/config';

const parseNonNegativeInt = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
};

export const graphqlConfig = registerAs('graphql', () => ({
  path: process.env.GRAPHQL_PATH ?? '/graphql',
  playground: process.env.GRAPHQL_PLAYGROUND === 'true',
  introspection: process.env.GRAPHQL_INTROSPECTION !== 'false',
  autoSchemaFile: process.env.GRAPHQL_AUTO_SCHEMA_FILE ?? 'src/core/graphql/schema.gql',
  depthLimit: parseNonNegativeInt(process.env.GRAPHQL_DEPTH_LIMIT, 7),
  complexityLimit: parseNonNegativeInt(process.env.GRAPHQL_COMPLEXITY_LIMIT, 1000),
  depthLimitDisabled: process.env.GRAPHQL_DEPTH_LIMIT_DISABLED === 'true',
  complexityLimitDisabled: process.env.GRAPHQL_COMPLEXITY_ENABLED === 'false',
  /**
   * The endpoint rate limit. Applied as an Apollo plugin rather than the global
   * `ThrottlerGuard`, because Apollo mounts `/graphql` as raw Express
   * middleware and the Nest guard chain never runs for it.
   */
  rateLimit: parseNonNegativeInt(process.env.GRAPHQL_RATE_LIMIT, 100),
  rateLimitTtlMs: parseNonNegativeInt(process.env.GRAPHQL_RATE_LIMIT_TTL_MS, 60_000),
  rateLimitDisabled: process.env.GRAPHQL_RATE_LIMIT_DISABLED === 'true',
}));

export type GraphqlConfig = ConfigType<typeof graphqlConfig>;
