# OpenAPI URL Probe — Trace

> **Source ticket**: TKT-1.1.1.3
> **Generated**: 2026-07-29 on branch `main`.
> **Purpose**: Capture the live OpenAPI endpoint reachability check. Re-run on any environment where the backend is expected to be reachable.

## Probe command

```bash
curl -fsS --max-time 5 http://localhost:8080/api/v1/docs/openapi.json \
  | jq '.info.title, .info.version, (.paths | length)'
```

## Result on this run (2026-07-29)

```
curl: (7) Failed to connect to localhost port 8080 after 0 ms: Could not connect to server
HTTP=000 BYTES=0
```

**Status: BLOCKED — backend not running locally at probe time.**

This is expected in environments where Docker / Postgres / Redis are not started. The probe will pass once `pnpm start:dev` (or `pnpm db:start && pnpm redis:start && pnpm db:migrate && pnpm start:dev`) has run.

## Reviewer action

To complete this ticket's acceptance criteria, run on a machine where the backend is reachable:

1. Start the backend (`pnpm start:dev`).
2. Re-run the probe command above.
3. Confirm:
   - `curl` exits 0.
   - `jq` parses the response without error.
   - `.info.title` is non-empty (typically the value of `appConfig().name`).
   - `.info.version` is non-empty (typically the value of `appConfig().version`).
   - `.paths | length` is > 0 (the backend today exposes ~140 paths across 23 controllers + 2 gateways).
4. Paste the output back into the PR thread.

## Cross-references

- The same URL is consumed by `pnpm generate:openapi` (which curls it into `docs/generated/openapi.json`). Keeping this trace aligned with that file's regeneration is part of the implicit contract with TKT-1.1.2.5.
- The URL constant is mirrored by `SMOKE_OPENAPI_URL` in TKT-1.1.1.4's `smoke:openapi` script.
