---
name: nestjs-rate-limiting
description: Designs abuse-resistant rate limiting for NestJS APIs using Redis or the project's existing storage, including per-user, per-IP, route-specific limits, and distributed deployment considerations.
---

# NestJS Rate Limiting

Rate limiting is a security and capacity control. Do not assume an in-memory limiter works across multiple application replicas.

## Workflow
Inspect the existing adapter, proxy topology, authentication lifecycle, Redis client, and current throttling implementation. Identify high-risk endpoints and the identity key for each.

## Design rules
- Prefer a distributed store such as Redis when the API runs multiple replicas.
- Choose keys deliberately: authenticated user, API key, IP, or a combination based on endpoint semantics.
- Treat forwarded IP headers as untrusted unless the reverse proxy chain is configured and trusted.
- Apply stricter policies to login, OTP, password reset, registration, expensive search, and resource-intensive operations.
- Consider separate limits for anonymous and authenticated traffic.
- Return consistent 429 responses and an appropriate `Retry-After` when possible.
- Avoid leaking whether an account exists through different throttling behavior.
- Define behavior during Redis outages: fail-open or fail-closed based on endpoint risk, and document the trade-off.
- Ensure limits account for legitimate NAT/shared-IP traffic and do not accidentally block entire organizations.
- Do not treat rate limiting as a substitute for authorization or input validation.

## Verification
Test identity key selection, multiple app instances, boundary windows, burst behavior, proxy headers, Redis failure behavior, and response headers.
