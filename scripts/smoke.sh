#!/usr/bin/env bash
#
# smoke.sh — full backend smoke gate for CI.
#
# Stages (in order):
#   1. /api/v1/health                       — overall liveness (DB + Redis)
#   2. /api/v1/docs/openapi.json            — OpenAPI artifact availability
#   3. /api/v1/health/liveness (alias)      — liveness ping (same as #1 in this codebase)
#   4. validateEnv(.env.example)            — env-sample validation (Epic 1.5, US-1.5.3)
#
# Behavior:
#   - Default: assume the backend is already running (CI will have started it).
#     Useful locally too: run `pnpm start:dev` in one terminal, `bash scripts/smoke.sh` in another.
#   - SMOKE_START_BACKEND=1: also attempts to start the backend if it's not responding.
#     Intended for local one-shot runs; CI uses the pre-started backend.
#   - SKIP_SMOKE_ENV=1: skip the env-validation stage (#4) entirely.
#
# Exit codes:
#   0 — every probed endpoint responded successfully AND env sample accepted
#   1 — any stage failed (with a clear per-step error message)
#
# Source ticket: TKT-1.1.3.1 (stages 1–3), ET-1.5-F1 (stage 4)
# Parent epic:   Epic 1.1 + Epic 1.5
set -euo pipefail

BASE_URL="${SMOKE_BASE_URL:-http://localhost:8080}"
API_PREFIX="${SMOKE_API_PREFIX:-/api/v1}"
HEALTH_PATH="${SMOKE_HEALTH_PATH:-/health}"
OPENAPI_PATH="${SMOKE_OPENAPI_PATH:-/docs/openapi.json}"

HEALTH_URL="${BASE_URL}${API_PREFIX}${HEALTH_PATH}"
OPENAPI_URL="${BASE_URL}${API_PREFIX}${OPENAPI_PATH}"

# Reuse the openapi-specific script rather than re-implement its logic.
# Cross-batch consistency check #3: smoke.sh must extend smoke:openapi's list, not redefine it.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
SMOKE_OPENAPI_SH="${SCRIPT_DIR}/smoke-openapi.sh"
SMOKE_ENV_SH="${SCRIPT_DIR}/smoke-env-validation.sh"

step_count=0
fail_count=0

run_step() {
  local label="$1"
  shift
  step_count=$((step_count + 1))

  echo "[smoke] step ${step_count}: ${label}"
  if "$@"; then
    echo "[smoke] step ${step_count}: OK"
    return 0
  else
    local rc=$?
    echo "[smoke] step ${step_count}: FAIL (exit ${rc})" >&2
    fail_count=$((fail_count + 1))
    return ${rc}
  fi
}

# Step 1: health endpoint — must return HTTP 200 (status: 'up' or 'degraded')
#         or HTTP 503 (status: 'down'). The latter is a legitimate health-check
#         response and should NOT fail this script; a 200/503 with a JSON body
#         is success. We tolerate both so a Redis-down-but-DB-up state still passes.
probe_health() {
  # On connect failure, curl's `-w '%{http_code}'` writes "000" AND exits non-zero.
  # Capturing via $(... || echo X) yields BOTH concatenated ("000000" = "000" + "X").
  # Workaround: explicitly redirect curl's stdout to /dev/null when it fails,
  # OR accept that curl wrote 000 and only add echo's output if curl gave nothing.
  local status=""
  status="$(curl -sS --max-time 5 --retry 0 -o /dev/null -w '%{http_code}' "${HEALTH_URL}" 2>/dev/null || true)"
  if [[ -z "${status}" ]]; then
    status="000"
  fi

  case "${status}" in
    200|503)
      # Validate body has a .status field.
      local body_file
      body_file="$(mktemp)"
      if ! curl -sS --max-time 5 --retry 0 -o "${body_file}" "${HEALTH_URL}" 2>/dev/null; then
        echo "[smoke] ${HEALTH_URL}: could not fetch body" >&2
        rm -f "${body_file}"
        return 1
      fi
      if ! jq -e '.status' "${body_file}" >/dev/null 2>&1; then
        echo "[smoke] ${HEALTH_URL}: response missing .status field" >&2
        rm -f "${body_file}"
        return 1
      fi
      rm -f "${body_file}"
      return 0
      ;;
    *)
      echo "[smoke] ${HEALTH_URL}: HTTP ${status} (expected 200 or 503)" >&2
      return 1
      ;;
  esac
}

# Step 2: openapi endpoint — delegate to smoke-openapi.sh.
probe_openapi() {
  if [[ ! -x "${SMOKE_OPENAPI_SH}" ]]; then
    echo "[smoke] ${SMOKE_OPENAPI_SH}: not found or not executable" >&2
    return 1
  fi
  SMOKE_OPENAPI_URL="${OPENAPI_URL}" bash "${SMOKE_OPENAPI_SH}"
}

# Step 3: liveness — for now this is the same as /health. The ticket left
# this open ("/api/v1/health/liveness or whatever liveness path the backend
# exposes; verify from health.controller.ts"). Reading health.controller.ts
# shows there is no separate liveness endpoint — /health doubles as liveness.
# We probe /health a second time with a tighter timeout to detect flapping.
probe_liveness() {
  local status=""
  status="$(curl -sS --max-time 2 --retry 0 -o /dev/null -w '%{http_code}' "${HEALTH_URL}" 2>/dev/null || true)"
  if [[ -z "${status}" ]]; then
    status="000"
  fi
  if [[ "${status}" == "200" ]]; then
    return 0
  fi
  echo "[smoke] liveness ${HEALTH_URL}: HTTP ${status}" >&2
  return 1
}

# Step 4: env-sample validation — verify that validateEnv() accepts the
# contents of .env.example. This proves the Epic 1.5 exit criterion
# ("backend boots with a sample .env") is true at the config layer, before
# NestJS even starts. The helper script can be skipped via SKIP_SMOKE_ENV=1
# for environments where validating a second .env.example is redundant
# (e.g. CI steps that already use a substitute env file).
probe_env_validation() {
  if [[ "${SKIP_SMOKE_ENV:-0}" == "1" ]]; then
    echo "[smoke] SKIP_SMOKE_ENV=1 — skipping"
    return 0
  fi
  if [[ ! -x "${SMOKE_ENV_SH}" ]]; then
    echo "[smoke] ${SMOKE_ENV_SH}: not found or not executable" >&2
    return 1
  fi
  bash "${SMOKE_ENV_SH}"
}

# Optional auto-start. Intended for local convenience; CI does not use this.
maybe_start_backend() {
  if [[ "${SMOKE_START_BACKEND:-0}" != "1" ]]; then
    return 0
  fi
  echo "[smoke] SMOKE_START_BACKEND=1 set — attempting to start backend"
  echo "[smoke] NOTE: this assumes a working Postgres + Redis. Run \`pnpm db:start\` and \`pnpm redis:start\` first."
  pnpm start:dev >/tmp/smoke-backend.log 2>&1 &
  echo "[smoke] backend started in background as $!; waiting up to 60s for readiness"
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 2 -o /dev/null "${HEALTH_URL}" 2>/dev/null; then
      echo "[smoke] backend ready"
      return 0
    fi
    sleep 1
  done
  echo "[smoke] backend did not become ready within 60s" >&2
  return 1
}

main() {
  echo "[smoke] probing ${BASE_URL}"
  maybe_start_backend || exit 1

  run_step "health endpoint ${HEALTH_URL}" probe_health || true
  run_step "openapi endpoint ${OPENAPI_URL}" probe_openapi || true
  run_step "liveness endpoint ${HEALTH_URL}" probe_liveness || true
  run_step "env validation against .env.example" probe_env_validation || true

  echo
  if [[ ${fail_count} -eq 0 ]]; then
    echo "[smoke] PASS — ${step_count}/${step_count} steps succeeded"
    exit 0
  fi
  echo "[smoke] FAIL — ${fail_count} of ${step_count} steps failed" >&2
  exit 1
}

main "$@"
