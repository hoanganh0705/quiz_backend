---
name: nestjs-code-review
description: Reviews NestJS code changes for correctness, security, maintainability, database integrity, performance, and test gaps. Use before merging or after AI-generated code changes.
---

# NestJS Code Review

Review the diff as a skeptical senior backend engineer. Prioritize real defects over stylistic preferences.

## Review order
1. Correctness and edge cases.
2. Security: auth, authorization, ownership, validation, secrets, injection, rate limits, data exposure.
3. Data integrity: constraints, transactions, races, migrations, idempotency.
4. Reliability: timeouts, retries, queue duplication, external failures, shutdown.
5. Performance: N+1, unbounded reads, indexes, event-loop blocking, unnecessary calls.
6. Architecture: boundaries, dependency direction, controller responsibilities, duplicated rules.
7. Tests and operability: regression tests, logs, metrics, recovery.

## Rules
Inspect actual diff and surrounding code. Report confirmed bugs separately from risks and optional improvements. Do not invent vulnerabilities or demand patterns without a concrete reason.

## Output
Findings first, ordered Critical / High / Medium / Low. Each finding includes location, failure scenario, impact, and fix. Then list test gaps and residual risks. If none, say so and state what was not verified.
