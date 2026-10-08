/**
 * Per-request GraphQL context factory.
 *
 * Loaders are rebuilt for every request so a batched lookup is never shared
 * between two callers. The authenticated principal is resolved here from the
 * bearer token rather than by the HTTP guard, because a single query may mix
 * public and gated fields and each field decides for itself whether a principal
 * is required.
 *
 * The repository is resolved per request through `ModuleRef` rather than
 * injected once, because the GraphQL module is initialised before the feature
 * modules that own the repository and cannot depend on them at construction
 * time.
 */
import type { JwtService } from '@nestjs/jwt';
import type { ModuleRef } from '@nestjs/core';

import type { JwtConfig } from '@/core/config';
import { isUserRole } from '@/common/types/user-role.type';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports/quiz-repository.port';
import type { QuizRepositoryPort } from '@/modules/quiz/domain/ports/quiz-repository.port';
import { createGqlLoaders, type GqlLoaders } from './graphql-loaders';
import type { GqlContext } from './graphql-context';

type GraphQLRequest = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: JwtPayload;
};

const readHeader = (request: GraphQLRequest, name: string): string | undefined => {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * An invalid or absent token resolves to no principal rather than raising.
 * Gated fields degrade to `null` for anonymous callers, so rejecting the whole
 * query here would leave an expired token no better than being signed out.
 */
const resolvePrincipal = async (
  request: GraphQLRequest,
  verify: (token: string) => Promise<JwtPayload>,
): Promise<JwtPayload | undefined> => {
  const header = readHeader(request, 'authorization');
  if (!header) return undefined;

  const [scheme, token] = header.trim().split(/\s+/);
  if (scheme !== 'Bearer' || !token) return undefined;

  try {
    const payload = await verify(token);
    if (!payload?.sub || !isUserRole(payload.role)) return undefined;
    return payload;
  } catch {
    return undefined;
  }
};

/**
 * Builds the context function handed to the driver. Kept separate from the
 * module wiring so context construction is testable without a Nest container.
 */
export const createGqlContextFactory =
  (moduleRef: ModuleRef, jwtService: JwtService, jwt: JwtConfig) =>
  async ({ req }: { req?: GraphQLRequest } = {}): Promise<GqlContext> => {
    const request = req ?? {};
    const repository = resolveLoaderRepository(moduleRef);

    const user = await resolvePrincipal(request, (token) =>
      jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwt.accessSecret,
        issuer: jwt.issuer,
        audience: jwt.audience,
      }),
    );

    return {
      req: {
        headers: request.headers,
        ip: request.ip,
        socket: request.socket,
        user: undefined,
      },
      user,
      loaders: repository,
    };
  };
/**
 * The repository is absent when no resolver needs batched lookups, for example
 * in a schema-only bootstrap. Loaders then resolve to empty results rather
 * than failing the request, so context construction stays independent of which
 * feature modules happen to be loaded.
 */
const resolveLoaderRepository = (moduleRef: ModuleRef): GqlLoaders | null => {
  let repository: QuizRepositoryPort | undefined;
  try {
    repository = moduleRef.get<QuizRepositoryPort>(QUIZ_REPOSITORY_PORT, { strict: false });
  } catch {
    return null;
  }
  return repository ? createGqlLoaders(repository) : null;
};
