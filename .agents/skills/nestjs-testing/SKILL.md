---
name: nestjs-testing
description: Creates NestJS unit, integration, and end-to-end tests with realistic dependency boundaries, database isolation, and meaningful assertions. Use when implementing features, fixing bugs, or reviewing test coverage.
---

# NestJS Testing

Write tests that prove observable behavior and protect important invariants.

## Workflow
Inspect the project's test framework, scripts, fixtures, factories, database strategy, and conventions. Choose the narrowest test level that proves the behavior.

## Test design
- Unit-test business rules and application services with explicit fakes/mocks.
- Integration-test persistence against an isolated test database where practical.
- E2E-test important HTTP contracts, validation, auth, authorization, and errors.
- Cover success, failure, boundary, and concurrency-sensitive cases.
- Assert outcomes and side effects, not private method calls.
- Control time, randomness, external APIs, and async job execution.
- Never point tests at production databases or real customer data.
- Isolate test state; tests must not depend on execution order.
- For bug fixes, add a regression test that fails before the fix where feasible.

## Completion
Run targeted tests then broader suites where reasonable. Report skipped tests and blockers honestly.
