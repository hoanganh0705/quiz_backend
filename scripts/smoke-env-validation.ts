/**
 * scripts/smoke-env-validation.ts
 *
 * CI smoke: verify that validateEnv() accepts the contents of `.env.example`.
 *
 * Behavior:
 *   - Reads QUIZ_BACKEND_ENV_FILE (default: .env.example, resolved against this file's dir).
 *   - Loads it via dotenv into process.env WITHOUT overriding values that are
 *     already set in the environment (so a CI step with inline env vars still wins
 *     over the sample file).
 *   - Calls validateEnv() and asserts no exception is thrown.
 *   - Exits 0 on success, non-zero with a clear error on failure.
 *
 * Why "no override": the CI workflow at .github/workflows/backend-smoke.yml sets
 * real secrets inline (DATABASE_URL pointing at the GH Actions Postgres service).
 * Letting dotenv override those would break the workflow.
 *
 * Source ticket: ET-1.5-F1 (Epic 1.5, Batch F).
 */

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateEnv } from '../src/core/config/env.validation';

const SCRIPT_DIR = __dirname;
const ENV_FILE = process.env.QUIZ_BACKEND_ENV_FILE ?? '.env.example';
const ENV_PATH = resolve(SCRIPT_DIR, '..', ENV_FILE);

if (!existsSync(ENV_PATH)) {
  console.error(`[smoke:env] ${ENV_FILE} not found at ${ENV_PATH}`);
  process.exit(1);
}

const loaded = loadDotenv({ path: ENV_PATH, override: false });
if (loaded.error) {
  console.error(`[smoke:env] dotenv failed to parse ${ENV_PATH}: ${loaded.error.message}`);
  process.exit(1);
}

const envRecord: Record<string, unknown> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined) envRecord[k] = v;
}

try {
  const validated = validateEnv(envRecord);
  const keyCount = Object.keys(validated).length;
  console.log(`[smoke:env] OK: validateEnv() accepted ${ENV_FILE} (${keyCount} keys)`);
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[smoke:env] FAIL: validateEnv() rejected ${ENV_FILE}: ${message}`);
  process.exit(1);
}
