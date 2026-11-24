---
name: nestjs-observability
description: Adds production observability to NestJS services through structured logging, correlation IDs, metrics, tracing, health checks, and actionable error reporting.
---

# NestJS Observability

Make production behavior diagnosable without exposing secrets or overwhelming operators.

## Workflow
Inspect the existing logger, deployment platform, telemetry stack, request lifecycle, and health-check conventions before adding dependencies.

## Logging
- Prefer structured logs with stable fields: timestamp, level, service, environment, request/correlation ID, operation, and safe context.
- Never log passwords, tokens, authorization headers, cookies, secret configuration, or unnecessary personal data.
- Use appropriate levels; avoid logging the same exception at every layer.
- Include stack traces for unexpected server errors while keeping client responses sanitized.
- Avoid high-cardinality identifiers as metric labels.

## Metrics and tracing
- Measure request count, latency, error rate, queue depth/age, job failures, DB pool saturation, and external dependency health where useful.
- Use histograms for latency distributions and bounded label values.
- Propagate trace/correlation context across HTTP, queues, and downstream calls when supported.
- Avoid introducing multiple overlapping telemetry SDKs.

## Health checks
- Separate liveness from readiness.
- Liveness should indicate whether the process can continue running; readiness should reflect whether it can safely accept traffic.
- Do not make every optional dependency a liveness requirement.
- Protect detailed diagnostic endpoints from public exposure.

## Verification
Confirm logs are structured and redacted, metrics are bounded, trace context propagates, and probes reflect actual deployment semantics.
