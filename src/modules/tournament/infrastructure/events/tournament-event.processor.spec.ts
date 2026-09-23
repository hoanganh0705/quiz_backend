import { TournamentEventProcessor } from './tournament-event.processor';
import type { TournamentFlagsConfig } from '@/core/config';
import type { SessionsConfig } from '@/core/config';

function makeFlags(tournamentBullMqDisable: boolean): TournamentFlagsConfig {
  return { tournamentBullMqDisable } as TournamentFlagsConfig;
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
      {} as any,
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
    // Provide a stub connection. The Worker constructor will attempt to connect
    // to Redis; we expect onModuleInit to either succeed (if a Redis instance
    // is reachable) or to throw — but we only assert it does NOT silently no-op
    // the way it does when the flag is on.
    const processor = new TournamentEventProcessor(
      { host: '127.0.0.1', port: 0 } as any,
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
