# Security Boot Checks — Operator Runbook

> Pre-deploy checklist for production. Every box MUST be checked
> before the new pod replaces the previous one. The boot-time
> validators in `core/config/env.validation.ts` enforce most of
> this automatically; this runbook exists so the operator can
> verify the invariants **before** pushing the image, and so a
> failed boot can be diagnosed against a known-good baseline.

## Source of truth

- `src/core/config/env.validation.ts` — `validateEnv()`.
- `src/core/config/jwt.config.ts` — `jwtConfig()` re-validates.
- `src/core/config/server.config.ts` — `serverConfig()`.
- `src/core/config/redis.config.ts` — `redisConfig()`.
- `src/modules/health/metrics.controller.ts` — token gate.
- [ADR-0031](../adr/0031-jwt-boot-safety.md).
- [ADR-0033](../adr/0033-financial-ops-permission-split.md).
- [ADR-0034](../adr/0034-admin-only-dtos.md).
- `docs/standards/migration.md` § "Security invariants at boot".

## Pre-deploy checklist

### 1. Secrets & credentials

- [ ] `JWT_ACCESS_TOKEN_SECRET` is set, at least 32 characters,
      with at least 16 distinct characters.
- [ ] `JWT_REFRESH_TOKEN_SECRET` is set, satisfies the same
      entropy rule, and differs from `JWT_ACCESS_TOKEN_SECRET`.
- [ ] `DATABASE_URL` is a real `postgres://` URL with the
      production credential (not the `CHANGE_ME` placeholder).
- [ ] `RESEND_API_KEY` is the production key from the Resend
      dashboard (not the `re_test_…` sandbox key).
- [ ] `CLOUDINARY_API_SECRET` and `CLOUDINARY_API_KEY` are the
      production cloud credentials.
- [ ] `GOOGLE_CLIENT_ID` is the production OAuth client.
- [ ] `PROMETHEUS_SCRAPE_TOKEN` is a freshly generated
      high-entropy string (e.g. `openssl rand -base64 32`).

### 2. CORS & origin policy

- [ ] `CORS_ORIGINS` is the comma-separated allow-list for the
      production web and admin front-ends. No `*`, no
      `localhost`, no dev URLs.
- [ ] `CORS_ORIGINS` parses cleanly with no extra whitespace
      (the validator strips whitespace but a misordered
      environment variable is the most common silent failure).

### 3. Cloudinary folder hygiene

- [ ] `CLOUDINARY_FOLDER` is set to a non-development value
      (the validator rejects `quiz-app-dev` in production).

### 4. Proxy & rate-limit posture

- [ ] `TRUST_PROXY` is `true` only when the service sits behind
      a known reverse proxy that strips and re-injects
      `X-Forwarded-*`. Otherwise it is `false`.
- [ ] `MAX_ACTIVE_SESSIONS_PER_USER` matches the documented
      capacity (default 5).

### 5. Operator permission split

- [ ] At least one operator holds `COIN_GRANT`.
- [ ] At least one operator holds `COIN_CLAWBACK`.
- [ ] At least one operator holds `COIN_READ_LEDGER`.
- [ ] No operator holds all three permissions unless that
      operator has been explicitly authorized.
- [ ] `COIN_ADMIN_DAILY_CAP` matches the operational ceiling
      documented in the runbook for the relevant region.

### 6. Observability

- [ ] Prometheus is configured to send
      `X-Prometheus-Token: $PROMETHEUS_SCRAPE_TOKEN` on every
      scrape.
- [ ] The `quiz_http_log_volume_total`, `quiz_ws_throttler_rejections_total`,
      and `quiz_coin_admin_grant_total` alerts are wired to the
      on-call channel.
- [ ] The `/metrics` endpoint is reachable only from the
      Prometheus scraper (private subnet or network policy).

### 7. WebSocket CORS

- [ ] `server.corsOrigins` includes the production front-end
      origins; the `RedisIoAdapter` derives WS CORS from this
      list, so no separate WS allow-list exists.
- [ ] The reverse proxy forwards `Upgrade: websocket` and
      `Connection: Upgrade` headers for the WS path.

### 8. Smoke test

- [ ] `pnpm db:migrate` succeeds against the production
      replica.
- [ ] `pnpm db:seed` is NOT run in production.
- [ ] The container boots in under 30 seconds. A boot time
      greater than 60 seconds usually means a missing
      environment variable or an unreachable Redis.
- [ ] `curl https://<host>/health` returns 200 with
      `{ "status": "ok" }`.
- [ ] `curl https://<host>/metrics` returns 401 without the
      Prometheus token and 200 with it.
- [ ] `curl -H "Origin: https://app.example.com" -H "Access-Control-Request-Method: GET" -X OPTIONS https://<host>/v1/...`
      returns the expected CORS headers.

## Diagnosing a failed boot

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `JWT_ACCESS_TOKEN_SECRET must be at least 32 characters long` | Forgotten or short secret. | Re-generate with `openssl rand -base64 32`. |
| `JWT_ACCESS_TOKEN_SECRET must contain at least 16 distinct characters` | Repeating characters. | Re-generate; do not paste a phrase. |
| `CORS_ORIGINS must be set in production` | Empty or missing. | Set to the production allow-list. |
| `PROMETHEUS_SCRAPE_TOKEN must be set in production` | Empty or missing. | Generate a token and wire it into both the server and Prometheus. |
| `CLOUDINARY_FOLDER must not be "quiz-app-dev" in production` | Folder still defaults. | Set to the production folder name. |
| `REDIS_KEY_PREFIX must be a non-empty string in production` | Empty prefix. | Set to `prod:` or the operational prefix. |
| `DATABASE_URL must use postgres/postgresql protocol` | Wrong scheme or empty. | Confirm the URL starts with `postgres://`. |

## Rollback

If a deploy must be rolled back:

1. Stop the new pod.
2. Re-attach the previous pod.
3. Investigate using the table above.
4. Re-run the smoke test against the rolled-back pod.
5. File an incident if any of the security invariants listed
   above were bypassed (e.g. `TRUST_PROXY=true` left in
   production without a known proxy).
