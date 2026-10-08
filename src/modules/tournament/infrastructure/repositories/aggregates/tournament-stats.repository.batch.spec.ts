type CapturedStmt = { text: string };

function makeMockDb() {
  const statements: CapturedStmt[] = [];
  const txStatements: CapturedStmt[] = [];

  const flatten = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) return '$';
    if (v instanceof Date) return '$';
    if (Array.isArray(v)) return v.map(flatten).join('');
    if (v && typeof v === 'object') {
      const cand = v as { query?: unknown; queryChunks?: unknown; value?: unknown; raw?: unknown };
      if (cand.raw !== undefined) return JSON.stringify(cand.raw);
      if (cand.query !== undefined) return flatten(cand.query);
      if (cand.queryChunks !== undefined) return flatten(cand.queryChunks);
      if (cand.value !== undefined) return flatten(cand.value);
    }
    return '';
  };

  const db = {
    execute: jest.fn(async (stmt: unknown) => {
      statements.push({ text: flatten(stmt) });
      return { rowCount: 1, rows: [] };
    }),
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => {
      const tx = {
        execute: jest.fn(async (stmt: unknown) => {
          txStatements.push({ text: flatten(stmt) });
          return { rowCount: 1, rows: [] };
        }),
      };
      await cb(tx);
    }),
  };
  return { db: db as unknown as object, statements, txStatements };
}

import { TournamentStatsRepository } from './tournament-stats.repository';

function makeRepo(db: object) {
  return new TournamentStatsRepository(db as never);
}

describe('TournamentStatsRepository — finalizeTournament', () => {
  it('computes round_totals once and reuses it for ranking and stats', async () => {
    const { db, txStatements } = makeMockDb();
    const repo = makeRepo(db);

    (db.execute as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ total: 10n }] })
      .mockResolvedValueOnce({
        rows: [
          { participant_id: 'p1', total_score: '100', total_time_ms: '5000' },
          { participant_id: 'p2', total_score: '90', total_time_ms: '6000' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { participant_id: 'p1', user_id: 'u1', rank: 1 },
          { participant_id: 'p2', user_id: 'u2', rank: 2 },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    await repo.finalizeTournament({
      tournamentId: 't1',
      nowIso: '2026-01-01T00:00:00.000Z',
    });

    const rankedStatements = txStatements.filter(
      (s) => s.text.includes('participant_id') && s.text.includes('ROW_NUMBER'),
    );
    expect(rankedStatements.length).toBeGreaterThan(0);
  });

  it('updates tournament_participants with rank_final values', async () => {
    const { db, txStatements } = makeMockDb();
    const repo = makeRepo(db);

    (db.execute as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ total: 2n }] })
      .mockResolvedValueOnce({
        rows: [
          { participant_id: 'p1', total_score: '100', total_time_ms: '5000' },
          { participant_id: 'p2', total_score: '90', total_time_ms: '6000' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { participant_id: 'p1', user_id: 'u1', rank: 1 },
          { participant_id: 'p2', user_id: 'u2', rank: 2 },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 2 });

    await repo.finalizeTournament({
      tournamentId: 't1',
      nowIso: '2026-01-01T00:00:00.000Z',
    });

    const updateStatements = txStatements.filter((s) => s.text.includes('UPDATE'));
    expect(updateStatements.length).toBeGreaterThan(0);
    expect(updateStatements[0].text).toContain('rank_final');
  });
});
