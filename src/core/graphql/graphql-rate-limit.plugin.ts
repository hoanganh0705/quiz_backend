/**
 * Rate limiting for the GraphQL endpoint.
 *
 * `ThrottlerGuard` is registered as a global Nest guard, which covers every
 * REST controller, but Apollo mounts `/graphql` as raw Express middleware
 * rather than as a routed handler, so the guard chain never runs for it and the
 * endpoint would otherwise be unthrottled.
 *
 * The limiter is applied as an Apollo plugin instead, which sees every GraphQL
 * operation. It is deliberately a plain in-process fixed-window counter: the
 * GraphQL surface is a single endpoint on one node, and reusing the REST
 * Redis storage here would make a schema-only bootstrap depend on a cache
 * being reachable.
 *
 * An over-limit operation is rejected with an HTTP 429 and a `RATE_LIMITED`
 * code in `extensions`, so a client can distinguish throttling from a genuine
 * GraphQL failure without inspecting the message.
 */
import { GraphQLError } from 'graphql';

import { RATE_LIMITED_CODE, RATE_LIMITED_MESSAGE } from './graphql-error.constants';
import type { GqlRequest } from './graphql-context';

export type GraphqlRateLimitOptions = {
  /** Requests permitted per window, per client. */
  limit: number;
  /** Window length in milliseconds. */
  ttlMs: number;
  /** Overrides the clock, primarily for tests. */
  now?: () => number;
  /** Derives the bucket key from the request. Defaults to the client IP. */
  keyResolver?: (request: unknown, contextValue: unknown) => string;
};

type Window = { count: number; resetAt: number };

/**
 * The subset of the Apollo request this plugin reads. Typed locally rather
 * than imported from `@apollo/server` because the driver config is checked
 * against the CommonJS build of the package while this file resolves the ESM
 * one, and the two declaration sets are not assignable to each other.
 */
type RateLimitRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

const firstHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Buckets by the client address.
 *
 * The address is read from the Express request carried on the GraphQL context
 * rather than from the GraphQL request headers, which Apollo Server leaves
 * empty for a request routed through an HTTP integration.
 */
const defaultKeyResolver = (request: unknown, contextValue: unknown): string => {
  const contextReq = (contextValue as { req?: GqlRequest } | undefined)?.req;
  const requestHeaders = (request as RateLimitRequest | undefined)?.headers;
  const forwarded =
    firstHeaderValue(contextReq?.headers?.['x-forwarded-for']) ??
    firstHeaderValue(requestHeaders?.['x-forwarded-for']);

  return (
    forwarded?.split(',')[0]?.trim() ||
    contextReq?.ip ||
    contextReq?.socket?.remoteAddress ||
    firstHeaderValue(requestHeaders?.host) ||
    'anonymous'
  );
};

/**
 * Rejects an operation once the client exceeds its window.
 */
export const buildGraphqlRateLimitPlugin = ({
  limit,
  ttlMs,
  now = Date.now,
  keyResolver = defaultKeyResolver,
}: GraphqlRateLimitOptions) => {
  const windows = new Map<string, Window>();

  return {
    async requestDidStart() {
      await Promise.resolve();
      return {
        async didResolveOperation({ request, contextValue }) {
          await Promise.resolve();
          const key = keyResolver(request, contextValue);
          const timestamp = now();
          const existing = windows.get(key);

          if (!existing || existing.resetAt <= timestamp) {
            windows.set(key, { count: 1, resetAt: timestamp + ttlMs });
            return;
          }

          if (existing.count >= limit) {
            // Apollo keys the response status off a nested `http` extension,
            // so `status` stays free to carry the RFC 7807 status the error
            // formatter publishes and the client already branches on.
            throw new GraphQLError(RATE_LIMITED_MESSAGE, {
              extensions: { code: RATE_LIMITED_CODE, status: 429, http: { status: 429 } },
            });
          }

          existing.count += 1;
        },
      };
    },
  };
};
