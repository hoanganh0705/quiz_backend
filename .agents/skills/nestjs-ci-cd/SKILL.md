---
name: nestjs-ci-cd
description: Designs CI/CD pipelines for NestJS repositories, including linting, type checking, tests, builds, migration safety, artifact promotion, and deployment gates.
---

# NestJS CI/CD

Inspect the current CI provider, package manager, lockfile, deployment model, secret handling, and existing scripts. Do not replace a working pipeline without a clear benefit.

## Pipeline stages
1. Install dependencies reproducibly from the lockfile.
2. Run formatting checks, linting, and TypeScript checks.
3. Run unit tests and relevant integration/e2e tests.
4. Build the production artifact or container image.
5. Run dependency/security checks according to repository policy.
6. Publish an immutable artifact.
7. Deploy through environment-specific approvals and health verification.

## Safety rules
- Never expose secrets in logs, artifacts, or untrusted pull-request contexts.
- Use least-privilege CI credentials and short-lived identity federation where supported.
- Separate build from deploy; promote the same immutable artifact between environments.
- Do not run production migrations automatically without an explicit release strategy, backup/rollback plan, and compatibility review.
- Prefer backward-compatible expand/contract migrations for zero-downtime releases.
- Avoid deployment steps that can run concurrently without coordination.
- Define rollback and post-deployment verification.
- Cache dependencies safely; do not let caches become a source of untrusted executable artifacts.

## Verification
Validate pipeline syntax, branch/environment protections, secret scope, artifact identity, migration gates, deployment health checks, and rollback instructions.
