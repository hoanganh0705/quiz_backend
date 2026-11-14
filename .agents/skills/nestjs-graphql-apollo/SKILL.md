---
name: nestjs-graphql-apollo
description: Designs and implements this NestJS GraphQL subsystem using Apollo Server, code-first schemas, secure resolvers, DataLoader batching, and query depth/complexity controls. Use when changing GraphQL modules, object types, resolvers, guards, or GraphQL performance/security.
---

# NestJS GraphQL with Apollo

This application uses NestJS GraphQL with Apollo Server, DataLoader, `graphql-depth-limit`, and `graphql-query-complexity`. Inspect the installed versions and existing GraphQL module configuration before editing. Preserve the current code-first conventions and avoid introducing a second GraphQL server or competing validation/security layer.

## Required workflow
1. Inspect GraphQL module configuration, driver, schema generation options, resolver organization, context factory, guards/interceptors, DataLoader registration, and package versions.
2. Read neighboring object types, input types, resolvers, services, and tests before adding a field or operation.
3. Trace authentication and authorization from the GraphQL context through resolver/service to resource-level access.
4. Identify query fan-out and nested relation access before choosing DataLoader or query changes.
5. Verify generated schema and execute representative GraphQL operations after changes.

## Code-first schema rules
- Use the project's existing NestJS decorators and code-first schema conventions for object types, input types, enums, fields, nullability, and resolver return types.
- Keep GraphQL transport types separate from persistence models; do not expose Drizzle rows directly.
- Make nullability intentional. Understand GraphQL non-null propagation before changing a field from nullable to non-null.
- Use explicit input types and validate inputs at the boundary; TypeScript types alone do not validate runtime input.
- Avoid exposing internal fields, secrets, token values, or fields the caller is not authorized to see.
- Treat schema changes as API changes; consider compatibility for existing clients and generated schema artifacts.
- Do not duplicate business logic across query and mutation resolvers. Delegate to application services/use cases.

## Resolver and authorization rules
- Keep resolvers thin: argument/context extraction, authorization boundary, and delegation.
- Enforce authorization for every sensitive query, mutation, and nested field. A parent resolver's authorization does not automatically secure every child field.
- Apply object-level ownership and tenant checks in the service/policy layer; never trust client-supplied owner or tenant identifiers.
- Ensure field resolvers cannot reveal protected data through nested traversal.
- Use guards or decorators consistently with the project's GraphQL execution context. Do not assume HTTP-only `ExecutionContext.switchToHttp()` works for GraphQL without the correct context adaptation.
- Avoid N+1 authorization lookups; batch safely where possible without mixing users or permission scopes.

## DataLoader and N+1 rules
- Use DataLoader for repeated per-parent lookups when batching materially reduces database round trips.
- Prefer request-scoped loaders or an equivalent design that prevents cross-request and cross-user cache leakage.
- Batch function output must preserve the exact input-key order and return one result per key, including explicit null/missing handling.
- Deduplicate keys where useful and chunk batches to respect database parameter limits.
- Avoid returning an unordered database result directly; map rows back to requested keys.
- Do not create a DataLoader for every relation automatically. Inspect actual resolver access patterns.
- Do not let DataLoader cache stale authorization decisions or data across tenants/users.
- For aggregates and complex nested data, consider a purpose-built query/service rather than excessive field-by-field resolver calls.

## Query depth and complexity protection
- Preserve and verify the configured `graphql-depth-limit` and `graphql-query-complexity` protections.
- Confirm the plugins/rules are actually wired into the Apollo request lifecycle; package installation alone is not protection.
- Choose limits based on real schema/query behavior and operational capacity, not arbitrary large defaults.
- Assign higher complexity to expensive fields and nested collections where supported.
- Bound list arguments with maximum page sizes; depth limits do not replace pagination.
- Test deeply nested and high-complexity operations and verify they are rejected before expensive resolver/database work.
- Consider aliases, fragments, introspection policy, and batching behavior in the actual threat model.
- Return safe, consistent errors without leaking internal query plans or stack traces.

## Performance and reliability
- Avoid unbounded nested lists and over-fetching.
- Use DataLoader batching, targeted selections, and efficient database queries based on observed access patterns.
- Set request-level timeouts/limits consistent with the rest of the API.
- Be deliberate about subscriptions and long-lived operations if present; do not assume ordinary HTTP request lifecycle semantics.
- Do not log full GraphQL variables when they may contain credentials or personal data.

## Verification
- Test generated SDL/schema compatibility.
- Test authentication, role/permission checks, object-level access, and nested-field authorization.
- Test DataLoader ordering, missing keys, duplicate keys, batching, and request isolation.
- Test that excessive depth/complexity is rejected before expensive work.
- Add regression coverage for any resolver N+1 or data-leak issue.
- Use the project's test setup and mocks; do not require a production Apollo endpoint or database.
