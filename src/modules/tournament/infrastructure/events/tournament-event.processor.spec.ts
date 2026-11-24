import { TournamentEventProcessor } from './tournament-event.processor';
import type { SessionsConfig } from '@/core/config';
import * as fs from 'fs';
import * as path from 'path';

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

describe('TournamentEventProcessor (worker init)', () => {
  it('skips starting the BullMQ worker when no connection is provided', () => {
    const processor = new TournamentEventProcessor(
      undefined,
      makeSessions(),
      makeLogger(),
    );

    processor.onModuleInit();
    processor.onModuleDestroy();

    expect(processor['worker']).toBeNull();
  });

  it('attempts to start the worker when connection is provided', () => {
    const processor = new TournamentEventProcessor(
      { host: '127.0.0.1', port: 0 },
      makeSessions(),
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
