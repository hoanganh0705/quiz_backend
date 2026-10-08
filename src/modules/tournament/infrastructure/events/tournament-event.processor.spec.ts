import { TournamentEventProcessor } from './tournament-event.processor';
import type { TournamentFlagsConfig } from '@/core/config';
import type { SessionsConfig } from '@/core/config';
import * as fs from 'fs';
import * as path from 'path';

function makeFlags(tournamentBullMqDisable: boolean): TournamentFlagsConfig {
  return { tournamentBullMqDisable };
}

function makeLogger(): any {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeSessions(): SessionsConfig {
  return { tournamentQueueConcurrency: 1 } as SessionsConfig;
}

describe('TournamentEventProcessor (flag-gated worker init)', () => {
  it('skips starting the BullMQ worker when TOURNAMENT_BULLMQ_DISABLE is true', () => {
    const processor = new TournamentEventProcessor(
      {},
      makeSessions(),
      makeFlags(true),
      makeLogger(),
    );

    processor.onModuleInit();
    processor.onModuleDestroy();

    expect(processor['worker']).toBeNull();
  });

  it('skips starting the BullMQ worker when no connection is provided', () => {
    const processor = new TournamentEventProcessor(
      undefined,
      makeSessions(),
      makeFlags(false),
      makeLogger(),
    );

    processor.onModuleInit();
    processor.onModuleDestroy();

    expect(processor['worker']).toBeNull();
  });

  it('attempts to start the worker when flag is false and connection is provided', () => {
    const processor = new TournamentEventProcessor(
      { host: '127.0.0.1', port: 0 },
      makeSessions(),
      makeFlags(false),
      makeLogger(),
    );

    try {
      processor.onModuleInit();
    } catch {
      // worker construction can throw without a reachable Redis — acceptable
    } finally {
      processor.onModuleDestroy().catch(() => undefined);
    }
  });
});

describe('TournamentEventProcessor (log-and-relay contract)', () => {
  it('does not import or call outbox writers, XP ingest, or profile mutators', () => {
    const sourcePath = path.join(__dirname, 'tournament-event.processor.ts');
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(stripped).not.toMatch(/outboxEvents\.(insert|insertInto)/);
    expect(stripped).not.toMatch(/xpIngestionService\.(ingest|ingestXp)/i);
    expect(stripped).not.toMatch(/userProfileService\.applyMutation/i);
  });
});
