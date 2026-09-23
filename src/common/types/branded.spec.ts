import {
  asAchievementId,
  asAttemptId,
  asCoinTransactionId,
  asQuizId,
  asTournamentId,
  asUserId,
  isAchievementId,
  isAttemptId,
  isCoinTransactionId,
  isQuizId,
  isTournamentId,
  isUserId,
} from './branded';

describe('branded ids', () => {
  const sample = 'abc-123';

  it('casts strings to branded ids', () => {
    expect(asUserId(sample)).toBe(sample);
    expect(asAttemptId(sample)).toBe(sample);
    expect(asQuizId(sample)).toBe(sample);
    expect(asTournamentId(sample)).toBe(sample);
    expect(asAchievementId(sample)).toBe(sample);
    expect(asCoinTransactionId(sample)).toBe(sample);
  });

  it('type guards accept strings and reject non-strings', () => {
    expect(isUserId(sample)).toBe(true);
    expect(isUserId(123)).toBe(false);
    expect(isUserId(null)).toBe(false);
    expect(isUserId(undefined)).toBe(false);

    expect(isAttemptId(sample)).toBe(true);
    expect(isAttemptId(123)).toBe(false);

    expect(isQuizId(sample)).toBe(true);
    expect(isQuizId(123)).toBe(false);

    expect(isTournamentId(sample)).toBe(true);
    expect(isTournamentId(123)).toBe(false);

    expect(isAchievementId(sample)).toBe(true);
    expect(isAchievementId(123)).toBe(false);

    expect(isCoinTransactionId(sample)).toBe(true);
    expect(isCoinTransactionId(123)).toBe(false);
  });

  it('branded ids remain string-compatible', () => {
    const userId = asUserId(sample);
    const asString: string = userId;
    expect(asString).toBe(sample);
    expect(`${userId}`).toBe(sample);
  });
});
