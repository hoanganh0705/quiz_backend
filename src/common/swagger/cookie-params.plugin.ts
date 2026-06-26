import { SetMetadata } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

export const COOKIE_PARAM_METADATA_KEY = 'swagger:cookie-params';

type CookieParamDefinition = {
  name: string;
  required: boolean;
  description?: string;
};

/**
 * Marks a route handler as consuming a named cookie.
 *
 * Used to declaratively drive the Swagger plugin that injects `in: 'cookie'`
 * parameters into the generated OpenAPI document. NestJS Swagger has no
 * native decorator for individual cookie params, so this metadata is the
 * single source of truth and is reflected automatically.
 *
 * @example
 * ```ts
 * @ApiCookieParam('refreshToken', { required: true })
 * refreshToken() { ... }
 * ```
 */
export const ApiCookieParam = (
  name: string,
  options: { required?: boolean; description?: string } = {},
): MethodDecorator & ClassDecorator => {
  const definition: CookieParamDefinition = {
    name,
    required: options.required ?? false,
    description: options.description,
  };
  return SetMetadata(COOKIE_PARAM_METADATA_KEY, definition);
};

type RegistryEntry = {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'trace';
  definition: CookieParamDefinition;
};

const COOKIE_PARAM_REGISTRY: RegistryEntry[] = [];

/**
 * Register a cookie parameter binding for a specific route. Called from
 * `AuthController` at module-load time (inside the class body, evaluated
 * once on first import) so the registration is captured before Swagger
 * builds the document.
 *
 * @internal
 */
export function registerCookieParam(
  path: string,
  method: RegistryEntry['method'],
  definition: CookieParamDefinition,
): void {
  if (COOKIE_PARAM_REGISTRY.some((e) => e.path === path && e.method === method)) return;
  COOKIE_PARAM_REGISTRY.push({ path, method, definition });
}

/**
 * Returns a snapshot of all registered cookie parameter bindings.
 *
 * @internal
 */
export function getCookieParamRegistry(): readonly RegistryEntry[] {
  return COOKIE_PARAM_REGISTRY;
}

/**
 * Patches the generated OpenAPI document to add `in: 'cookie'` parameters for
 * every endpoint registered via `registerCookieParam`.
 *
 * Renaming a route or moving it under a different prefix is safe as long as
 * the route registration in the controller is updated to match — the plugin
 * no longer hardcodes any path strings.
 */
export function injectCookieParams(doc: OpenAPIObject): void {
  const paths = doc.paths;
  if (!paths) return;

  for (const entry of getCookieParamRegistry()) {
    const pathItem = paths[entry.path] as Record<string, unknown> | undefined;
    if (!pathItem) continue;
    const operation = pathItem[entry.method] as Record<string, unknown> | undefined;
    if (!operation) continue;

    const params = (operation.parameters ?? []) as Array<Record<string, unknown>>;
    if (params.some((p) => p.name === entry.definition.name && p.in === 'cookie')) continue;
    params.push({
      name: entry.definition.name,
      in: 'cookie',
      required: entry.definition.required,
      description:
        entry.definition.description ??
        'HTTP-only refresh token cookie issued during login or a previous refresh.',
      schema: { type: 'string' },
    });
    operation.parameters = params;
  }
}
