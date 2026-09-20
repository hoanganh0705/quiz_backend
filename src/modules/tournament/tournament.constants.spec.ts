import { computeTournamentXp, TOURNAMENT_RANKING_XP_TABLE } from './tournament.constants';

describe('computeTournamentXp', () => {
  it('returns 500 XP for rank 1', () => {
    expect(computeTournamentXp(1)).toBe(500);
  });

  it('returns 250 XP for rank 2 and 3', () => {
    expect(computeTournamentXp(2)).toBe(250);
    expect(computeTournamentXp(3)).toBe(250);
  });

  it('returns 100 XP for rank 4 through 10', () => {
    for (const rank of [4, 5, 6, 7, 8, 9, 10]) {
      expect(computeTournamentXp(rank)).toBe(100);
    }
  });

  it('returns 50 XP for rank 11 through 25', () => {
    for (const rank of [11, 15, 20, 25]) {
      expect(computeTournamentXp(rank)).toBe(50);
    }
  });

  it('returns 25 XP for rank 26 through 50', () => {
    for (const rank of [26, 30, 40, 50]) {
      expect(computeTournamentXp(rank)).toBe(25);
    }
  });

  it('returns 0 XP for ranks above 50', () => {
    expect(computeTournamentXp(51)).toBe(0);
    expect(computeTournamentXp(100)).toBe(0);
    expect(computeTournamentXp(1000)).toBe(0);
  });

  it('returns 0 XP for ranks below 1', () => {
    expect(computeTournamentXp(0)).toBe(0);
    expect(computeTournamentXp(-1)).toBe(0);
  });

  it('returns 0 XP for non-integer ranks', () => {
    expect(computeTournamentXp(1.5)).toBe(0);
    expect(computeTournamentXp(NaN)).toBe(0);
    expect(computeTournamentXp(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('matches the TOURNAMENT_RANKING_XP_TABLE for in-range ranks', () => {
    for (let rank = 1; rank <= 50; rank += 1) {
      expect(computeTournamentXp(rank)).toBe(TOURNAMENT_RANKING_XP_TABLE[rank] ?? 0);
    }
  });

  it('uses the same value for the table lookup and the helper', () => {
    expect(computeTournamentXp(7)).toBe(TOURNAMENT_RANKING_XP_TABLE[7]);
  });
});
