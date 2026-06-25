import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * Direct injection of cookie parameters for endpoints that use the `refreshToken` cookie.
 *
 * NestJS Swagger does not natively support `in: 'cookie'` via decorators.
 * This function patches the generated OpenAPI document to add cookie parameters
 * for the two endpoints that require it.
 *
 * Apply by spreading the result into the operation definition.
 */
export function injectCookieParams(doc: OpenAPIObject): void {
  const paths = doc.paths;
  if (!paths) return;

  const cookieParams = {
    refreshToken: {
      name: 'refreshToken',
      in: 'cookie' as const,
      required: false,
      description: 'HTTP-only refresh token cookie issued during login or a previous refresh.',
      schema: { type: 'string' },
    },
  };

  const addCookie = (
    path: string,
    method: string,
    cookieName: keyof typeof cookieParams,
    required: boolean,
  ): void => {
    const pathItem = paths[path] as Record<string, unknown> | undefined;
    if (!pathItem) return;

    const operation = pathItem[method] as Record<string, unknown> | undefined;
    if (!operation) return;

    const params = (operation.parameters ?? []) as Array<Record<string, unknown>>;
    if (params.some((p) => p.name === cookieName && p.in === 'cookie')) return;

    const cookieDef = { ...cookieParams[cookieName], required };
    params.push(cookieDef);
    operation.parameters = params;
  };

  // POST /api/v1/auth/refresh-token  — refreshToken is required
  addCookie('/api/v1/auth/refresh-token', 'post', 'refreshToken', true);
  // POST /api/v1/auth/logout         — refreshToken is optional
  addCookie('/api/v1/auth/logout', 'post', 'refreshToken', false);
}
