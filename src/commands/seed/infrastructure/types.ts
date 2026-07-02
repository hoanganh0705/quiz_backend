import type { db } from './db-client';

export type SeedDb = typeof db;
export type SeedTx = Parameters<Parameters<SeedDb['transaction']>[0]>[0];

export type UserRole = 'admin' | 'moderator' | 'user';

export type SeedSummary = {
  domain: string;
  inserted: number;
  updated: number;
  skipped: number;
};

export type SeedContext = {
  nowIso: string;
};

export type SeedCommand = {
  name: string;
  description: string;
  run: (ctx: SeedContext) => Promise<SeedSummary[]>;
};

export type SeedDomain = {
  domain: string;
  run: (tx: SeedTx, ctx: SeedContext) => Promise<SeedSummary>;
};

export type SeedGroup = {
  name: string;
  description: string;
  commands: SeedCommand[];
};

export type RawUserSeed = {
  email: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  bio: string;
  avatarUrl: string;
  settings?: Record<string, unknown>;
};

export type NormalizedUserSeed = {
  email: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  bio: string;
  avatarUrl: string;
  settings: Record<string, unknown>;
};

export type RawCategorySeed = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
};

export type NormalizedCategorySeed = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
};

export type RawTagSeed = {
  name: string;
  slug: string;
};

export type NormalizedTagSeed = {
  name: string;
  slug: string;
};

export type RawBadgeSeed = {
  slug: string;
  type: 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze';
  name: string;
  description: string;
  iconUrl?: string;
  isActive: boolean;
  rules: BadgeRuleSeed[];
};

export type BadgeRuleSeed = {
  ruleType:
    | 'count'
    | 'rank'
    | 'rank_period'
    | 'streak'
    | 'tournament_win'
    | 'perfect_score'
    | 'xp_total';
  priority?: number;
  config: Record<string, unknown>;
  isActive?: boolean;
};

export type QuizSeed = {
  slug: string;
  title: string;
  description: string | null;
  creatorUsername: string;
  isFeatured: boolean;
  isHidden: boolean;
  /** Optional: slug of the category to assign to this quiz via the join table. */
  categorySlug?: string;
  /** Optional: tag slugs to assign to this quiz via the join table. */
  tagSlugs?: string[];
  versions: QuizVersionSeed[];
};

export type QuizVersionSeed = {
  versionNumber: number;
  status: 'draft' | 'published' | 'archived';
  difficulty: 'easy' | 'medium' | 'hard';
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
  questions: QuizQuestionSeed[];
};

export type QuizQuestionSeed = {
  position: number;
  questionText: string;
  imageUrl?: string | null;
  answerOptions: QuizAnswerOptionSeed[];
};

export type QuizAnswerOptionSeed = {
  position: number;
  value: string;
  isCorrect: boolean;
};

export type AttemptSeed = {
  attemptId: string;
  userUsername: string;
  quizSlug: string;
  versionNumber: number;
  status: 'started' | 'completed' | 'abandoned';
  scorePercent?: string;
  correctCount?: number;
  timeTakenMs?: number;
  xpEarned?: number;
};

export type TournamentSeed = {
  title: string;
  description: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'upcoming' | 'registration' | 'ongoing' | 'finished' | 'cancelled';
  prize: string | null;
  startAt: string;
  endAt: string;
  maxParticipants: number | null;
  categorySlug: string | null;
  quizSlugs: string[];
};

export type InstanceSeed = {
  quizSlug: string;
  versionNumber: number;
  hostUsername: string;
  status: 'open' | 'running' | 'closed' | 'finished';
  maxPlayers: number | null;
};
