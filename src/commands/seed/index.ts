import 'dotenv/config';
import { db, closePool, type SeedContext } from '../infrastructure';
import { logger } from '../infrastructure/seed-logger';

import {
  runUsersSeed,
  runCategoriesSeed,
  runTagsSeed,
  runBadgesSeed,
} from './foundation';

import {
  runQuizSeed,
  runAttemptSeed,
  runBookmarkSeed,
  runReviewSeed,
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
  const summaries = await logger.group('Foundation seeds', async () => {
    const results = [];
    // Order: badges (no FK deps) → users (needed by quiz/attempt seeds) → categories/tags
    results.push(await runBadgesSeed());
    results.push(await runUsersSeed());
    results.push(await runCategoriesSeed());
    results.push(await runTagsSeed());
    return results.flat();
  });
  console.log('\nFoundation summary:');
  for (const s of summaries) {
    console.log(`  ${s.domain}: inserted=${s.inserted}, updated=${s.updated}, skipped=${s.skipped}`);
  }
};

const runDevelopment = async (): Promise<void> => {
  const summaries = await logger.group('Development seeds', async () => {
    const results = [];
    // Order: quizzes (base) → attempts → bookmarks/reviews (depend on users + quizzes)
    results.push(await runQuizSeed());
    results.push(await runAttemptSeed());
    results.push(await runBookmarkSeed());
    results.push(await runReviewSeed());
    return results.flat();
  });
  console.log('\nDevelopment summary:');
  for (const s of summaries) {
    console.log(`  ${s.domain}: inserted=${s.inserted}, updated=${s.updated}, skipped=${s.skipped}`);
  }
};

const runScenarios = async (): Promise<void> => {
  const summaries = await logger.group('Scenario seeds', async () => {
    const results = [];
    results.push(await runTournamentSeed());
    results.push(await runInstanceSeed());
    return results.flat();
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
    await closePool();
  });
