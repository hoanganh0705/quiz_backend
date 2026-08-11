#!/usr/bin/env bash
#
# smoke-openapi.sh — fail CI if the live OpenAPI artifact is not reachable.
#
# Default URL: http://localhost:8080/api/v1/docs/openapi.json
# Override:    SMOKE_OPENAPI_URL=https://staging.example.com/api/v1/docs/openapi.json pnpm smoke:openapi
#
# Exit codes:
#   0 — URL returned HTTP 200 with a non-empty JSON body
#   1 — URL unreachable, non-200, or empty/invalid JSON
#
# Source ticket: TKT-1.1.1.4
# Parent epic:   Epic 1.1 (Tooling Readiness & OpenAPI Capture)
set -euo pipefail

URL="${SMOKE_OPENAPI_URL:-http://localhost:8080/api/v1/docs/openapi.json}"

echo "[smoke:openapi] probing ${URL}"

# Capture HTTP status and body separately.
http_body="$(mktemp)"
trap 'rm -f "${http_body}"' EXIT

# Probe status first (no body needed for the status check). Use --fail-with-body
# semantics carefully: we want to know the status even on connection failure,
# so we avoid `-f` and inspect the captured code. The `|| true` guard prevents
# `set -e` from killing the script on connection failure so we can still
# surface a clean error message.
http_status="$(curl -sS --max-time 5 --retry 0 -o /dev/null -w '%{http_code}' "${URL}" || true)"

if [[ -z "${http_status}" || "${http_status}" != "200" ]]; then
  echo "[smoke:openapi] FAIL: HTTP ${http_status:-<unreachable>} from ${URL}" >&2
  exit 1
fi

# Re-fetch body now that we know the URL is reachable.
if ! curl -sS --max-time 10 --retry 0 -o "${http_body}" "${URL}"; then
  echo "[smoke:openapi] FAIL: could not fetch body from ${URL}" >&2
  exit 1
fi

# Validate JSON shape with jq: must have a non-empty "paths" object.
if ! jq -e 'type == "object" and (.paths | type == "object") and (.paths | length > 0)' "${http_body}" >/dev/null 2>&1; then
  echo "[smoke:openapi] FAIL: response is not a non-empty OpenAPI document (paths object missing or empty)" >&2
  exit 1
fi

path_count="$(jq '.paths | length' "${http_body}")"
body_size="$(wc -c < "${http_body}" | tr -d ' ')"
echo "[smoke:openapi] OK: HTTP 200, ${body_size} bytes, ${path_count} paths"
exit 0
