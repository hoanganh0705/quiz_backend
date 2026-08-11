#!/usr/bin/env bash
#
# smoke-env-validation.sh — fail CI if validateEnv() rejects the contents of
# .env.example (or any other sample file passed via QUIZ_BACKEND_ENV_FILE).
#
# This is the env-validation half of the Epic 1.5 (US-1.5.3) smoke. It runs
# AFTER probe_health / probe_openapi / probe_liveness because those three
# prove the backend is up; this one proves that a fresh dev can copy the
# sample file to .env and have the backend boot without manual edits.
#
# Exit codes:
#   0 — validateEnv() accepted the sample file
#   1 — file not found, unparseable, or validateEnv() threw
#
# Env vars:
#   QUIZ_BACKEND_ENV_FILE — path to the sample file (default: .env.example,
#                           resolved relative to quiz_backend/)
#   SKIP_SMOKE_ENV        — if set to 1, skip this stage entirely
#
# Source ticket: ET-1.5-F1
# Parent epic:   Epic 1.5 — Environment Config & Documentation
set -euo pipefail

if [[ "${SKIP_SMOKE_ENV:-0}" == "1" ]]; then
  echo "[smoke:env] SKIP_SMOKE_ENV=1 — skipping env validation stage"
  exit 0
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
BACKEND_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

ENV_FILE="${QUIZ_BACKEND_ENV_FILE:-.env.example}"
ENV_PATH="${ENV_FILE}"
if [[ "${ENV_PATH}" != /* ]]; then
  ENV_PATH="${BACKEND_ROOT}/${ENV_PATH}"
fi

if [[ ! -f "${ENV_PATH}" ]]; then
  echo "[smoke:env] FAIL: ${ENV_FILE} not found at ${ENV_PATH}" >&2
  exit 1
fi

echo "[smoke:env] validating ${ENV_FILE} via validateEnv()"

# ts-node is a devDependency in quiz_backend; resolve it relative to the
# backend's node_modules so the script works whether invoked from the
# monorepo root or from quiz_backend/.
TS_NODE_BIN="${BACKEND_ROOT}/node_modules/.bin/ts-node"
if [[ ! -x "${TS_NODE_BIN}" ]]; then
  echo "[smoke:env] FAIL: ts-node not found at ${TS_NODE_BIN} — is pnpm install up to date?" >&2
  exit 1
fi

# Run the TS helper. Forward QUIZ_BACKEND_ENV_FILE in case the caller overrode it.
if QUIZ_BACKEND_ENV_FILE="${ENV_FILE}" "${TS_NODE_BIN}" "${SCRIPT_DIR}/smoke-env-validation.ts"; then
  exit 0
fi
echo "[smoke:env] FAIL: see error above" >&2
exit 1
