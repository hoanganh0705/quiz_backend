/**
 * GraphQL execution context.
 *
 * Carries the authenticated principal and the per-request DataLoaders.
 * Loaders are created per request so that batching never leaks across the
 * requests of two different users, and are absent when no resolver in the
 * schema depends on batched lookups.
 *
 * `req` is narrowed to what resolvers are allowed to read. The endpoint rate
 * limiter needs the client address, which lives on the Express request
 * prototype, so it is captured here rather than by spreading the raw request:
 * a spread copies own enumerable properties only and would drop it.
 */
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { GqlLoaders } from './graphql-loaders';

export interface GqlRequest {
  user?: JwtPayload;
  headers?: Record<string, string | string[] | undefined>;
  /** Client address as resolved by Express, honouring `trust proxy`. */
  ip?: string;
  socket?: { remoteAddress?: string };
}

export interface GqlContext {
  req?: GqlRequest;
  user?: JwtPayload;
  loaders: GqlLoaders | null;
}
