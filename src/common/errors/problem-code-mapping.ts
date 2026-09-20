/**
 * Transport-side mapping from `BaseDomainException.code` to HTTP metadata.
 *
 * Per the RFC 7807 migration plan (§6.4, §4.4), the HTTP-specific
 * information that turns a domain `code` into a Problem Details response
 * lives in the **transport layer**, not on the domain class. The domain
 * layer carries only `code` (a stable business identifier). The
 * transport layer owns the mapping from that code to `{ status, title,
 * typeUri }`.
 *
 * Sole consumer: `GlobalExceptionFilter`.
 *
 * Adding a new error: declare a `readonly code` on the concrete class
 * (domain-side) AND add the matching entry here (transport-side). The
 * unknown-code loud-failure branch in the global filter means a missing
 * entry surfaces as a 500 + `error: 'unknown_error_code'` log line.
 */
import { HttpStatus } from '@nestjs/common';
import type { ProblemCodeInfo } from './problem-code.types';

import { AuthProblemCodeMapping } from './problem-code-mappings/auth.problem-codes';
import { QuizProblemCodeMapping } from './problem-code-mappings/quiz.problem-codes';
import { AttemptProblemCodeMapping } from './problem-code-mappings/attempt.problem-codes';
import { UserProblemCodeMapping } from './problem-code-mappings/user.problem-codes';
import { CategoryProblemCodeMapping } from './problem-code-mappings/category.problem-codes';
import { TagProblemCodeMapping } from './problem-code-mappings/tag.problem-codes';
import { TournamentProblemCodeMapping } from './problem-code-mappings/tournament.problem-codes';
import { ReviewProblemCodeMapping } from './problem-code-mappings/review.problem-codes';
import { BookmarkProblemCodeMapping } from './problem-code-mappings/bookmark.problem-codes';
import { InstanceProblemCodeMapping } from './problem-code-mappings/instance.problem-codes';
import { SocialProblemCodeMapping } from './problem-code-mappings/social.problem-codes';
import { AchievementProblemCodeMapping } from './problem-code-mappings/achievement.problem-codes';
import { CommentProblemCodeMapping } from './problem-code-mappings/comment.problem-codes';
import { RankingProblemCodeMapping } from './problem-code-mappings/ranking.problem-codes';
import { NotificationProblemCodeMapping } from './problem-code-mappings/notification.problem-codes';
import { CoinProblemCodeMapping } from './problem-code-mappings/coin.problem-codes';
import { DailyChallengeProblemCodeMapping } from './problem-code-mappings/daily-challenge.problem-codes';

export const ProblemCodeMapping: Readonly<Record<string, ProblemCodeInfo>> = Object.freeze({
  ...AuthProblemCodeMapping,
  ...QuizProblemCodeMapping,
  ...AttemptProblemCodeMapping,
  ...UserProblemCodeMapping,
  ...CategoryProblemCodeMapping,
  ...TagProblemCodeMapping,
  ...TournamentProblemCodeMapping,
  ...ReviewProblemCodeMapping,
  ...BookmarkProblemCodeMapping,
  ...InstanceProblemCodeMapping,
  ...SocialProblemCodeMapping,
  ...AchievementProblemCodeMapping,
  ...CommentProblemCodeMapping,
  ...RankingProblemCodeMapping,
  ...NotificationProblemCodeMapping,
  ...CoinProblemCodeMapping,
  ...DailyChallengeProblemCodeMapping,
});

const DEFAULT_TYPE_URIS: Readonly<Record<number, string>> = {
  400: 'https://api.quiz.local/problems/bad-request',
  401: 'https://api.quiz.local/problems/unauthorized',
  403: 'https://api.quiz.local/problems/forbidden',
  404: 'https://api.quiz.local/problems/not-found',
  409: 'https://api.quiz.local/problems/conflict',
  422: 'https://api.quiz.local/problems/unprocessable-entity',
  423: 'https://api.quiz.local/problems/locked',
  429: 'https://api.quiz.local/problems/too-many-requests',
  500: 'https://api.quiz.local/problems/internal-server-error',
};

export { DEFAULT_TYPE_URIS };

/**
 * Look up the Problem Details metadata for a domain `code`.
 *
 * On hit: returns the entry from `ProblemCodeMapping`.
 * On miss: returns the unknown-code loud-failure branch — a 500 with
 * a generic title and the 500-default type URI. `GlobalExceptionFilter`
 * additionally emits an `error: 'unknown_error_code'` log line so the gap
 * is observable on-call.
 */
export function resolveProblemInfo(code: string): ProblemCodeInfo {
  const entry = ProblemCodeMapping[code];
  if (entry) return entry;
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: DEFAULT_TYPE_URIS[HttpStatus.INTERNAL_SERVER_ERROR] ?? '',
  };
}
