import { LeaderboardRepository } from './leaderboard.repository';
import { RankingPeriod } from '../../../domain/types/ranking.types';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeDb(rows: ReadonlyArray<Record<string, unknown>>): any {
  return {
    execute: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  };
}

function flattenSql(sqlValue: any): string {
  if (typeof sqlValue === 'string') return sqlValue;
  if (typeof sqlValue === 'number' || typeof sqlValue === 'boolean') return '';
  if (sqlValue === null || sqlValue === undefined) return '';
  if (Array.isArray(sqlValue)) return sqlValue.map(flattenSql).join('');
  if (typeof sqlValue === 'object') {
    if (sqlValue.value !== undefined) {
      return flattenSql(sqlValue.value);
    }
    if (Array.isArray(sqlValue.queryChunks)) {
      return flattenSql(sqlValue.queryChunks);
    }
    if (typeof sqlValue.query === 'string') {
      return sqlValue.query;
    }
  }
  return '';
}

describe('LeaderboardRepository (keyset pagination)', () => {
  it('emits a strict-tuple cursor predicate when all cursor fields are present', async () => {
    const fixtureRows = [
      {
        userId: '11111111-1111-7111-8111-111111111111',
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
        xp: 800,
        createdAt: '2026-05-01T00:00:00.000Z',
        rank: 4,
        denseRank: 4,
      },
    ];
    const db = makeDb(fixtureRows);
    const repo = new LeaderboardRepository(db, makeLogger());

    const result = await repo.getLeaderboardKeyset({
      period: RankingPeriod.WEEKLY,
      limit: 10,
      cursorXp: 1000,
      cursorCreatedAt: '2026-04-30T00:00:00.000Z',
      cursorUserId: '22222222-2222-7222-8222-222222222222',
    });

    expect(result).toEqual([
      {
        userId: '11111111-1111-7111-8111-111111111111',
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
        xp: 800,
        rank: 4,
        denseRank: 4,
      },
    ]);

    expect(db.execute).toHaveBeenCalledTimes(1);
    const sqlText = flattenSql(db.execute.mock.calls[0][0]);
    expect(sqlText).toContain('ur.weekly_xp <');
    expect(sqlText).toContain('ur.weekly_xp =');
    expect(sqlText).toContain('u.created_at >');
    expect(sqlText).toContain('u.user_id >');
  });

  it('omits the cursor predicate when no cursor is supplied', async () => {
    const db = makeDb([]);
    const repo = new LeaderboardRepository(db, makeLogger());

    await repo.getLeaderboardKeyset({
      period: RankingPeriod.ALL_TIME,
      limit: 50,
      cursorXp: null,
      cursorCreatedAt: null,
      cursorUserId: null,
    });

    const sqlText = flattenSql(db.execute.mock.calls[0][0]);
    expect(sqlText).not.toContain('ur.all_time_xp <');
    expect(sqlText).toContain('WHERE ur.all_time_xp > 0');
  });

  it('omits the cursor predicate when only some cursor fields are supplied', async () => {
    const db = makeDb([]);
    const repo = new LeaderboardRepository(db, makeLogger());

    await repo.getLeaderboardKeyset({
      period: RankingPeriod.MONTHLY,
      limit: 50,
      cursorXp: 500,
      cursorCreatedAt: null,
      cursorUserId: '33333333-3333-7333-8333-333333333333',
    });

    const sqlText = flattenSql(db.execute.mock.calls[0][0]);
    expect(sqlText).not.toContain('ur.monthly_xp <');
    expect(sqlText).toContain('WHERE ur.monthly_xp > 0');
  });

  it('getLeaderboardCursorFirstPage delegates to keyset with null cursor', async () => {
    const db = makeDb([]);
    const repo = new LeaderboardRepository(db, makeLogger());

    await repo.getLeaderboardCursorFirstPage({
      period: RankingPeriod.DAILY,
      limit: 25,
    });

    const sqlText = flattenSql(db.execute.mock.calls[0][0]);
    expect(sqlText).toContain('WHERE ur.daily_xp > 0');
  });

  it('includes the strict tiebreaker on user_id in the ORDER BY clause', async () => {
    const db = makeDb([]);
    const repo = new LeaderboardRepository(db, makeLogger());

    await repo.getLeaderboardKeyset({
      period: RankingPeriod.ALL_TIME,
      limit: 10,
      cursorXp: null,
      cursorCreatedAt: null,
      cursorUserId: null,
    });

    const sqlText = flattenSql(db.execute.mock.calls[0][0]);
    expect(sqlText).toContain('ORDER BY ur.all_time_xp DESC, u.created_at ASC, u.user_id ASC');
  });

  it('strips the createdAt column from the public LeaderboardRow result', async () => {
    const fixtureRows = [
      {
        userId: '11111111-1111-7111-8111-111111111111',
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
        xp: 800,
        createdAt: '2026-05-01T00:00:00.000Z',
        rank: 4,
        denseRank: 4,
      },
    ];
    const db = makeDb(fixtureRows);
    const repo = new LeaderboardRepository(db, makeLogger());

    const result = await repo.getLeaderboardKeyset({
      period: RankingPeriod.WEEKLY,
      limit: 10,
      cursorXp: null,
      cursorCreatedAt: null,
      cursorUserId: null,
    });

    expect(result[0]).not.toHaveProperty('createdAt');
    expect(result[0]).toHaveProperty('userId');
    expect(result[0]).toHaveProperty('rank');
  });
});
