export type Brand<T, K extends string> = T & { readonly __brand: K };

export type UserId = Brand<string, 'UserId'>;
export type AttemptId = Brand<string, 'AttemptId'>;
export type QuizId = Brand<string, 'QuizId'>;
export type TournamentId = Brand<string, 'TournamentId'>;
export type AchievementId = Brand<string, 'AchievementId'>;
export type CoinTransactionId = Brand<string, 'CoinTransactionId'>;

export const asUserId = (value: string): UserId => value as UserId;
export const asAttemptId = (value: string): AttemptId => value as AttemptId;
export const asQuizId = (value: string): QuizId => value as QuizId;
export const asTournamentId = (value: string): TournamentId => value as TournamentId;
export const asAchievementId = (value: string): AchievementId => value as AchievementId;
export const asCoinTransactionId = (value: string): CoinTransactionId => value as CoinTransactionId;

export const isUserId = (value: unknown): value is UserId => typeof value === 'string';
export const isAttemptId = (value: unknown): value is AttemptId => typeof value === 'string';
export const isQuizId = (value: unknown): value is QuizId => typeof value === 'string';
export const isTournamentId = (value: unknown): value is TournamentId => typeof value === 'string';
export const isAchievementId = (value: unknown): value is AchievementId =>
  typeof value === 'string';
export const isCoinTransactionId = (value: unknown): value is CoinTransactionId =>
  typeof value === 'string';
