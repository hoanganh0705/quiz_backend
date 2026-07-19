import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import type { DrizzleDB } from '@/core/database/database.module';
import { QuizAnalyticsRepository } from '@/modules/quiz/domain/analytics/quiz-analytics.repository';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics/quiz-analytics.service';
import { PopularityService } from '@/modules/quiz/domain/analytics/popularity.service';
import { TrendingService } from '@/modules/quiz/domain/analytics/trending.service';
import { MetricsRepository } from '@/modules/quiz/infrastructure/repositories/metrics.repository';

const PROD_OVERRIDE = 'ALLOW_PROD_BOOKMARK_METRICS_BACKFILL';

function usage(): void {
  console.log(`Usage:
  pnpm db:backfill:bookmark-metrics

Recomputes quiz_stats.bookmark_count for every active quiz by calling
QuizAnalyticsService.refreshBookmarkMetrics for each quiz.

Environment:
  DATABASE_URL                              Postgres connection string (required).
  NODE_ENV=production                       Enables the production safety gate.
  ${PROD_OVERRIDE}=true     Required to run in production.
`);
}

function parseCli(argv: readonly string[]): { help: boolean } {
  let help = false;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    throw new Error(`Unknown flag: ${arg} (try --help)`);
  }

  return { help };
}

function refuseInProduction(): void {
  if (process.env.NODE_ENV === 'production' && process.env[PROD_OVERRIDE] !== 'true') {
    throw new Error(
      `Refusing to run bookmark-metrics backfill in production. Set ${PROD_OVERRIDE}=true to override.`,
    );
  }
}

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value || value.trim().length === 0) {
    throw new Error('DATABASE_URL is required');
  }
  return value;
}

function createLogger(context: string): PinoLogger {
  const logger = new PinoLogger({
    pinoHttp: {
      level: process.env.NODE_ENV === 'test' ? 'warn' : 'info',
    },
  });
  logger.setContext(context);
  return logger;
}

async function main(): Promise<void> {
  const flags = parseCli(process.argv.slice(2));
  if (flags.help) {
    usage();
    return;
  }

  refuseInProduction();

  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const db = drizzle(pool, { schema }) as unknown as DrizzleDB;

  try {
    const metricsRepository = new MetricsRepository(db, createLogger(MetricsRepository.name));
    const analyticsRepository = new QuizAnalyticsRepository(db);
    const trendingService = new TrendingService(
      metricsRepository,
      createLogger(TrendingService.name),
    );
    const popularityService = new PopularityService(
      metricsRepository,
      db,
      createLogger(PopularityService.name),
    );
    const analyticsService = new QuizAnalyticsService(
      analyticsRepository,
      metricsRepository,
      trendingService,
      popularityService,
      createLogger(QuizAnalyticsService.name),
    );

    const summary = await analyticsService.refreshAllBookmarkMetrics();
    console.log(`[bookmark-metrics-backfill] summary: ${JSON.stringify(summary)}`);

    if (summary.errorCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(
    '[bookmark-metrics-backfill] failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
