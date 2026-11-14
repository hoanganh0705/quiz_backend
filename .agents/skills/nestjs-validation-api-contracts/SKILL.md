---
name: nestjs-validation-api-contracts
description: Defines and validates NestJS HTTP request and response contracts, DTOs, pipes, serialization, pagination, and OpenAPI documentation. Use when creating or changing API endpoints.
---

# NestJS Validation and API Contracts

Treat every HTTP request as untrusted and every response as a public contract.

## Workflow
Inspect global ValidationPipe settings, DTO conventions, serialization rules, API versioning, and OpenAPI setup. Reuse existing validation patterns.

## Rules
- Validate path, query, header, and body inputs where relevant.
- Prefer allow-list validation and reject unexpected fields where compatible.
- Transform query-string values deliberately; do not assume they are numbers or booleans.
- Bound pagination, page size, arrays, strings, and uploaded content.
- Never use TypeScript types alone as runtime validation.
- Do not return raw database records, secrets, password hashes, or private fields.
- Use consistent status codes and stable error response shapes.
- Document auth requirements, parameters, response schemas, and meaningful errors in OpenAPI.
- Keep DTOs at the transport boundary; map them to application inputs.
- Define omitted-versus-null semantics explicitly.

## Verification
Test missing, malformed, out-of-range, unexpected, and boundary values. Verify serialized responses and generated OpenAPI.
