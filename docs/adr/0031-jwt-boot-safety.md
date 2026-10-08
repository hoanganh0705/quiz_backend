# ADR-0031 — JWT Boot-Safety & Operational Hardening

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-09-26 |

## Context

The Phase 8 trust-boundary audit identified that the JWT layer relied
on defaults that are easy to misconfigure and that several production
boot invariants were enforced only in a single layer (either the
config factory or the env validator, but not both). Concrete gaps:

- A forgotten `JWT_ACCESS_TOKEN_SECRET` could silently start the
  service with an empty signing key, producing unsigned tokens and
  silently failing the first verify.
- A low-entropy or repeated-character secret (e.g. `aaaa…`) satisfies
  a `length >= 16` check but defeats every brute-force model.
- The Prometheus `/metrics` endpoint was open in production when
  `PROMETHEUS_SCRAPE_TOKEN` was empty, exposing internal counters
  (DLQ sizes, circuit-breaker state, cache hit rates) to any caller
  on the public network.
- `CORS_ORIGINS` defaulted to `*` via `localhost,5173` in
  `.env.example`; production deploys that copied the example as-is
  leaked CORS to any origin.
- `TRUST_PROXY=true` was the default in `.env.example`, which makes
  rate-limits and audit logs trust any `X-Forwarded-For` header.

## Decision

The boot-time configuration is now an enforced contract:

- **Empty-secret fail-fast.** `jwtConfig()` and `validateEnv()` both
  refuse to construct when `JWT_ACCESS_TOKEN_SECRET` or
  `JWT_REFRESH_TOKEN_SECRET` is missing or whitespace-only.
- **Min-entropy check.** Both secrets must be at least 32 characters
  AND contain at least 16 distinct characters. The check is a single
  source of truth in `parseHighEntropyString` inside
  `core/config/env.validation.ts`; `jwtConfig()` re-validates so the
  factory-level fail-fast survives if the env validator is ever
  bypassed.
- **Production CORS_ORIGINS.** `validateEnv()` requires a non-empty
  `CORS_ORIGINS` list when `NODE_ENV=production`. Empty values,
  comma-only, and whitespace-only lists are all rejected.
- **Production Prometheus token.** `PROMETHEUS_SCRAPE_TOKEN` is
  required in production; the `/metrics` controller uses the value
  to gate scrapes. The default empty token keeps the endpoint open
  in non-production environments so local debug is unaffected.
- **TRUST_PROXY default.** `.env.example` ships `TRUST_PROXY=false`
  with a comment explaining when it is safe to flip; the validator
  parses the boolean explicitly.
- **Database credential hygiene.** `.env.example` uses a
  `CHANGE_ME` placeholder for `DATABASE_URL` so an unwary developer
  who copies `.env.example` to `.env` does not commit a working
  `postgres:postgres` credential.

## Consequences

### Positive

- A misconfigured deploy fails fast at boot, not in the first
  request. Production deploys cannot silently run with empty JWT
  secrets or open `/metrics`.
- The high-entropy check defeats low-effort secrets (repeated chars,
  short phrases) that would otherwise pass a length-only check.
- Local development remains ergonomic: the defaults are
  dev-friendly, and the production-only checks fire only when
  `NODE_ENV=production`.

### Negative

- The 32-character / 16-unique-character floor adds friction for
  developers who copy a short string; the README and runbook
  document the `openssl rand -base64 32` generation flow.
- Re-validating in both the env validator and the config factory
  adds a small boot-time cost (microseconds). The cost is negligible
  compared to a single DB roundtrip but is documented for the
  curious.

## Evidence

- `src/core/config/env.validation.ts` (`parseHighEntropyString`,
  `validateEnv`).
- `src/core/config/jwt.config.ts` (`jwtConfig` fail-fast).
- `src/modules/health/metrics.controller.ts` (token gate).
- `.env.example` (`TRUST_PROXY`, `DATABASE_URL`, `CLOUDINARY_FOLDER`).
- `docs/standards/migration.md` § "Security invariants at boot".
- `docs/runbooks/security-boot-checks.md`.

## References

- ADR-0012 (Authentication Model — JWT Access + Refresh Token Rotation).
- ADR-0016 (Configuration Strategy — Environment Variables with Zod Validation).
- `docs/audit/phase8-security-trust-boundary-audit.md`.
- `docs/audit/phase9-security-remediation-plan.md` § P3.1–P3.5, § P6.1.
