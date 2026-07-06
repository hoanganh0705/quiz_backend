// =============================================================================
// Seed orchestrator
//
// Run with one of: foundation | development | scenarios | all (default: all).
//
// The classification of every table written by these seeds is documented in
// `PHASE_10_EVIDENCE_REPORT.md` at the repository root.
//
// After every run, a `SEED_RECORD.md` is written to the repository root
// containing login credentials and human-readable IDs for every seeded row.
// =============================================================================

import 'dotenv/config';
import { closePool } from './infrastructure';
import { logger } from './infrastructure/seed-logger';
import { recorder, writeSeedRecord } from './infrastructure/seed-recorder';
import type { SeedSummary } from './infrastructure/types';

import {
  runUsersSeed,
  runCategoriesSeed,
  runTagsSeed,
  runBadgesSeed,
} from './foundation';

import {
  runQuizSeed,
  runBookmarkSeed,
  runReviewSeed,
  runDiscussionSeed,
  runRankingSeed,
  runUserBadgeSeed,
  runNotificationSeed,
} from './development';

import {
  runTournamentSeed,
  runInstanceSeed,
} from './scenarios';

type SeedTarget = 'foundation' | 'development' | 'scenarios' | 'all';

const parseTarget = (): SeedTarget => {
  const arg = process.argv[2];
  if (arg === 'foundation') return 'foundation';
  if (arg === 'development') return 'development';
  if (arg === 'scenarios') return 'scenarios';
  return 'all';
};

const runFoundation = async (): Promise<void> => {
  let summaries: SeedSummary[] = [];
  await logger.group('Foundation seeds', async () => {
    const results: SeedSummary[] = [];
    // Order: badges (no FK deps) → users (needed by quiz/attempt seeds) → categories/tags
    results.push(await runBadgesSeed());
    results.push(await runUsersSeed());
    results.push(await runCategoriesSeed());
    results.push(await runTagsSeed());
    summaries = results;
  });
  console.log('\nFoundation summary:');
  for (const s of summaries) {
    console.log(`  ${s.domain}: inserted=${s.inserted}, updated=${s.updated}, skipped=${s.skipped}`);
  }
};

const runDevelopment = async (): Promise<void> => {
  let summaries: SeedSummary[] = [];
  await logger.group('Development seeds', async () => {
    const results: SeedSummary[] = [];
    // Order: quizzes (base) → ranking (sets xpTotal on users) → earned badges → notifications → reviews/discussions/bookmarks
    // NOTE: quiz_attempts and quiz_attempt_answers are ❌ DO NOT SEED (Phase 10 audit).
    // They are created by POST /attempts/start and POST /attempts/:id/answers in the real API flow.
    results.push(...(await runQuizSeed()));
    results.push(...(await runRankingSeed()));
    results.push(...(await runUserBadgeSeed()));
    results.push(...(await runNotificationSeed()));
    results.push(...(await runReviewSeed()));
    results.push(...(await runDiscussionSeed()));
    results.push(...(await runBookmarkSeed()));
    summaries = results;
  });
  console.log('\nDevelopment summary:');
  for (const s of summaries) {
    console.log(`  ${s.domain}: inserted=${s.inserted}, updated=${s.updated}, skipped=${s.skipped}`);
  }
};

const runScenarios = async (): Promise<void> => {
  let summaries: SeedSummary[] = [];
  await logger.group('Scenario seeds', async () => {
    const results: SeedSummary[] = [];
    results.push(...(await runTournamentSeed()));
    results.push(...(await runInstanceSeed()));
    summaries = results;
  });
  console.log('\nScenario summary:');
  for (const s of summaries) {
    console.log(`  ${s.domain}: inserted=${s.inserted}, updated=${s.updated}, skipped=${s.skipped}`);
  }
};

const main = async (): Promise<void> => {
  const target = parseTarget();

  logger.info(`Starting seed target: ${target}`);

  if (target === 'foundation' || target === 'all') {
    await runFoundation();
  }

  if (target === 'development' || target === 'all') {
    await runDevelopment();
  }

  if (target === 'scenarios' || target === 'all') {
    await runScenarios();
  }

  console.log('\nSeed completed successfully.');

  // Flush per-row records to SEED_RECORD.md at the repository root.
  // `process.cwd()` is the project root when the seed is invoked via
  // `pnpm db:seed:*`, which is the supported invocation path.
  writeSeedRecord(process.cwd());
};

main()
  .then(() => {
    console.log('\nAll seeds applied.');
  })
  .catch((error) => {
    logger.error('Seed failed', { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  })
  .finally(async () => {
    // Clear the in-memory buffer so subsequent runs (e.g. during testing)
    // don't accumulate stale records from a previous invocation.
    recorder.clear();
    await closePool();
  });
