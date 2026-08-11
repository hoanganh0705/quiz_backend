# Local Bootstrap Runbook

> **Source ticket**: TKT-1.1.1.5
> **Parent epic**: Epic 1.1 — Tooling Readiness & OpenAPI Capture
> **Audience**: Any developer with a clean checkout of `quiz_backend/`.

> **Time budget**: 15 minutes end-to-end on a machine with Docker and pnpm already installed. Section 2 has a per-step time estimate.

This runbook walks a new developer from a fresh clone to "regenerated SDK exists, smoke check passes" in five steps.

**Related architecture docs** (read alongside this runbook):

- [Architecture overview](../architecture/overview.md) — high-level system structure, request lifecycle, module map.
- [Project Constitution](../PROJECT_CONSTITUTION.md) — engineering principles and decision hierarchy that every change must follow.

---

## 1. Prerequisites

You will need:

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20.x or 22.x | NestJS 11 requires `>=20`. Pinned via `engines` in `package.json`. <https://nodejs.org/> or `nvm install 20`. |
| pnpm | 9.x or 10.x | Package manager is pinned to `9.15.0` via `packageManager` in `package.json` — use `corepack enable` to activate it. |
| Docker | 24.x+ | Required for `quizdb` (Postgres 18) and `quizredis` (Redis 8). Compose or Desktop both work. <https://docs.docker.com/get-docker/> |
| `curl` | any modern version | pre-installed on macOS/Linux. |
| `jq` | 1.6+ | `brew install jq` / `apt install jq`. |

On Windows, use WSL2 or a Linux VM — the smoke scripts use POSIX `bash` and `set -euo pipefail`.

> **Tip:** Verify your toolchain with `node -v && pnpm -v && docker -v && curl --version | head -1 && jq --version` before starting.

---

## 2. The 5-Step Bootstrap

All commands assume your working directory is `quiz_backend/`. Per-step time budgets sum to **≤15 min** on a warm cache; first run is closer to 20 min as Docker pulls the Postgres and Redis images.

| Step | Action | Time budget |
|---|---|---|
| 1 | Install backend deps | ~1 min |
| 2 | Start Postgres + Redis | ~2 min (first run ~5 min for image pull) |
| 3 | Run migrations + seed foundation | ~1 min |
| 4 | Start backend dev server | ~1 min (NestJS compile) |
| 5 | Frontend up + regenerate SDK | ~5 min (`pnpm install` for frontend + OpenAPI fetch + Orval codegen) |

### Step 1 — Install dependencies

```bash
pnpm install
```

Expected outcome: a `node_modules/` directory and `pnpm-lock.yaml` resolved without errors. If you see peer-dep warnings, they are non-blocking; file a follow-up if they error out.

### Step 2 — Start Postgres + Redis

```bash
pnpm db:start
pnpm redis:start
```

These scripts are idempotent: they start an existing `quizdb` / `quizredis` container if present, otherwise create one.

**Verify with:**

```bash
docker ps --filter name=quizdb --filter name=quizredis
```

Expected: both containers listed with status `Up`.

> Reference: the full list of available scripts lives in [`script-audit.md`](./script-audit.md).

### Step 3 — Migrate + seed the foundation

```bash
pnpm db:migrate
pnpm db:seed:foundation
```

Expected outcome: Drizzle applies all migrations to `quizdb`, then `db:seed:foundation` loads roles, permissions, and base taxonomy.

If you see `relation "..." does not exist`, you likely skipped `db:migrate` — go back to Step 3.

### Step 4 — Start the backend

```bash
pnpm start:dev
```

Expected outcome: NestJS logs show `Application is running on: http://localhost:8080/api/v1` and Swagger UI is reachable at `http://localhost:8080/api/v1/docs`.

When `NODE_ENV` is not `production` (or `SWAGGER_ENABLED=true`), interactive docs are served there. OpenAPI JSON lives at:

```text
http://localhost:8080/api/v1/docs/openapi.json
```

### Step 5 — Smoke check (backend) and regenerate SDK (frontend)

This step has two halves. Do them in order.

**5a — Smoke check.** In a **second terminal** (leave `start:dev` running), from `quiz_backend/`:

```bash
pnpm smoke:openapi
```

Expected output:

```text
[smoke:openapi] probing http://localhost:8080/api/v1/docs/openapi.json
[smoke:openapi] OK: HTTP 200, <N> bytes, <paths> paths
```

If the script exits `0`, then run the full smoke gate (this is the smoke command from Epic 1.1, US-1.1.3, embedded here verbatim):

```bash
bash scripts/smoke.sh
```

Expected output:

```text
[smoke] probing http://localhost:8080
[smoke] step 1: health endpoint ...
[smoke] step 1: OK
[smoke] step 2: openapi endpoint ...
[smoke] step 2: OK
[smoke] step 3: liveness endpoint ...
[smoke] step 3: OK
[smoke] PASS — 3/3 steps succeeded
```

If the script exits `0`, the backend side is healthy.

To target a non-default URL (e.g. a staging environment), pass it via `SMOKE_BASE_URL` / `SMOKE_OPENAPI_URL`:

```bash
SMOKE_BASE_URL=https://staging.example.com bash scripts/smoke.sh
```

**5b — Regenerate the frontend SDK.** In a third terminal, from `quiz_frontend/`:

```bash
pnpm install
pnpm generate:api
```

Expected outcome: `quiz_frontend/src/lib/api/generated/` is (re)populated from the live OpenAPI document at `http://localhost:8080/api/v1/docs/openapi.json`. Once `pnpm generate:api` exits 0, the runbook is complete — a regenerated SDK exists on disk.

---

## 3. Required Environment Variables

These are the keys declared in `.env.example`. The bootstrap will fail fast if `validateEnv()` rejects any of them. Copy `.env.example` to `.env` and fill in the secrets — **never commit `.env`**.

### Database

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection string used by Drizzle | `postgres://postgres:postgres@localhost:5432/quizdb` |

### Redis

| Variable | Purpose | Example |
|---|---|---|
| `REDIS_URL` | Redis connection string used by sessions, throttles, outbox | `redis://localhost:6379` |

### JWT (must be different, cryptographically random, ≥256-bit)

| Variable | Purpose |
|---|---|
| `JWT_ACCESS_TOKEN_SECRET` | Signs access tokens — generate with `openssl rand -base64 32` |
| `JWT_REFRESH_TOKEN_SECRET` | Signs refresh tokens — must differ from access token secret |
| `JWT_ACCESS_TOKEN_ISSUER` | `iss` claim value (default: `quiz-backend`) |
| `JWT_ACCESS_TOKEN_AUDIENCE` | `aud` claim value (default: `quiz-client`) |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token TTL (e.g. `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL (e.g. `7d`) |
| `REFRESH_TOKEN_COOKIE_MAX_AGE_MS` | Refresh cookie max-age in ms (e.g. `604800000`) |

### Sessions

| Variable | Purpose |
|---|---|
| `MAX_ACTIVE_SESSIONS_PER_USER` | Per-user session cap (e.g. `5`) |
| `REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS` | Reuse-detection window (e.g. `10`) |
| `SESSION_BINDING_STRICT` | If `true`, refresh tokens are bound to UA/IP |

### Email verification

| Variable | Purpose |
|---|---|
| `EMAIL_VERIFICATION_TOKEN_TTL_SECONDS` | TTL for verification tokens (e.g. `3600`) |
| `EMAIL_VERIFICATION_BASE_URL` | Public URL where users land when verifying |

### Password reset

| Variable | Purpose |
|---|---|
| `PASSWORD_RESET_TOKEN_TTL_SECONDS` | TTL for reset tokens (e.g. `3600`) |
| `PASSWORD_RESET_BASE_URL` | Public URL where users land when resetting |

### Email provider (Resend)

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER` | Always `resend` |
| `RESEND_API_KEY` | API key from <https://resend.com/api-keys> |
| `EMAIL_FROM_ADDRESS` | Sender (test: `onboarding@resend.dev`; prod: a verified domain) |
| `EMAIL_FROM_NAME` | Display name |

### Server / metadata

| Variable | Purpose |
|---|---|
| `TRUST_PROXY` | Pass `true` behind a reverse proxy so req.ip is correct |
| `CORS_ORIGINS` | Comma-separated allowed origins (must include `http://localhost:3000` for dev) |
| `NODE_ENV` | `development` / `test` / `production` |
| `PORT` | Default `8080` |
| `SWAGGER_ENABLED` | Optional — force Swagger UI in any env |
| `APP_NAME`, `APP_VERSION`, `APP_DESCRIPTION`, `APP_URL` | Surfaced in OpenAPI `info` block |
| `GOOGLE_CLIENT_ID` | OAuth — leave blank to disable Google login |

If `validateEnv()` rejects a value, the app crashes on boot with a message naming the bad key. Fix it in `.env` and restart.

---

## 4. Troubleshooting

### `pnpm db:start` fails with "bind: address already in use"

Port `5432` is occupied by another Postgres on the host. Either stop the other instance, or run `quizdb` on a different port (`docker run … -p 5433:5432 …`) and update `DATABASE_URL`.

### `pnpm start:dev` exits with "JWT_ACCESS_TOKEN_SECRET must be defined"

You forgot to copy `.env.example` to `.env`, or the secret is empty. Run:

```bash
cp .env.example .env
openssl rand -base64 32   # paste into JWT_ACCESS_TOKEN_SECRET
openssl rand -base64 32   # paste into JWT_REFRESH_TOKEN_SECRET (different value)
```

### `pnpm smoke:openapi` returns "HTTP 000 from http://localhost:8080/..."

The backend is not running, or it crashed. Check the `pnpm start:dev` terminal for stack traces. Common causes:

- Postgres not reachable → `pnpm db:start` and re-run.
- Redis not reachable → `pnpm redis:start` and re-run.
- `validateEnv()` threw on boot → fix `.env` and restart.

### `pnpm generate:openapi` exits with "Could not resolve host"

The backend is not running. Step 4 must complete successfully before regenerating.

### Migrations seem stale

Drop the volume and re-bootstrap (destructive — only on a fresh checkout):

```bash
pnpm db:reset
pnpm db:migrate
pnpm db:seed:foundation
```

### `pnpm install` warns about peer dependencies

These are advisory. If `pnpm install` exits with code `0`, proceed. If it exits non-zero, file a follow-up issue with the full output.

---

## Smoke checks

After Step 5 (`pnpm smoke:openapi` passes), run the full smoke gate from `quiz_backend/`:

```bash
bash scripts/smoke.sh
```

This probes three endpoints, in order: `/api/v1/health`, `/api/v1/docs/openapi.json` (via `scripts/smoke-openapi.sh`), and `/api/v1/health` again as a liveness ping.

### What to do if smoke fails

- **`curl: (7) Failed to connect`**: the backend isn't running. Go back to Step 4 (`pnpm start:dev`).
- **`HTTP 503 from /api/v1/health`**: the database is down. Check Postgres logs (`docker logs quizdb`); re-run `pnpm db:start` and `pnpm db:migrate`.
- **`HTTP 000 from /api/v1/docs/openapi.json`**: Swagger UI was disabled (set `SWAGGER_ENABLED=true` in `.env`, then restart) or the backend hasn't finished booting — wait a few seconds and retry.

### CI

The same script runs on every PR that touches `quiz_backend/**` via `.github/workflows/backend-smoke.yml`. It spins up Postgres + Redis as services, applies migrations, starts the backend, and invokes `scripts/smoke.sh`. A failing PR cannot merge.

---

## 5. Next Steps

After completing the 5-step bootstrap:

- Run `pnpm generate:openapi` (from `quiz_backend/`) to refresh the OpenAPI artifact under `docs/generated/`.
- From `quiz_frontend/`, run `pnpm generate:api` to regenerate the SDK against the live backend — that's Step 5b above.
- See the **Smoke checks** section above for the full `scripts/smoke.sh` reference and CI integration details.

---

_Last regenerated: 2026-07-29 against `quiz_backend/package.json` on branch `main`._
