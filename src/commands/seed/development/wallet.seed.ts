import { eq } from 'drizzle-orm';
import { db, type SeedContext, recorder } from '../infrastructure';
import { SeedLookup } from '../shared/seed-lookup';
import { userWallets, coinTransactions } from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';
import type { SeedSummary } from '../infrastructure/types';

interface UserWalletSeed {
  username: string;
  balance: number;
  transactions: {
    reason:
      | 'QUIZ_COMPLETION_REWARD'
      | 'QUIZ_PERFECT_BONUS'
      | 'DAILY_CHALLENGE_REWARD'
      | 'STREAK_MILESTONE_REWARD'
      | 'BADGE_REWARD'
      | 'TOURNAMENT_PLACEMENT_REWARD'
      | 'ADMIN_ADJUSTMENT';
    amount: number;
    referenceType?: string;
    referenceId?: string;
    metadata: Record<string, unknown>;
  }[];
}

const WALLET_SEEDS: UserWalletSeed[] = [
  {
    username: 'learner_user',
    balance: 350,
    transactions: [
      {
        reason: 'QUIZ_COMPLETION_REWARD',
        amount: 50,
        referenceType: 'quiz',
        metadata: { title: 'JavaScript Fundamentals', scorePercent: 80 },
      },
      {
        reason: 'QUIZ_PERFECT_BONUS',
        amount: 100,
        referenceType: 'quiz',
        metadata: { title: 'World History Chronicles', scorePercent: 100 },
      },
      {
        reason: 'STREAK_MILESTONE_REWARD',
        amount: 50,
        referenceType: 'streak',
        metadata: { days: 3 },
      },
      {
        reason: 'DAILY_CHALLENGE_REWARD',
        amount: 75,
        referenceType: 'daily_challenge',
        metadata: { challengeDate: 'yesterday' },
      },
      {
        reason: 'QUIZ_COMPLETION_REWARD',
        amount: 75,
        referenceType: 'quiz',
        metadata: { title: 'Modern Science Wonders', scorePercent: 75 },
      },
    ],
  },
  {
    username: 'power_user',
    balance: 2450,
    transactions: [
      {
        reason: 'QUIZ_COMPLETION_REWARD',
        amount: 100,
        referenceType: 'quiz',
        metadata: { title: 'System Design Primer', scorePercent: 100 },
      },
      {
        reason: 'QUIZ_PERFECT_BONUS',
        amount: 150,
        referenceType: 'quiz',
        metadata: { title: 'Algorithms Advanced', scorePercent: 100 },
      },
      {
        reason: 'TOURNAMENT_PLACEMENT_REWARD',
        amount: 1000,
        referenceType: 'tournament',
        metadata: { tournamentTitle: 'April System Design Cup', rank: 1 },
      },
      {
        reason: 'BADGE_REWARD',
        amount: 500,
        referenceType: 'badge',
        metadata: { badgeSlug: 'tournament-win' },
      },
      {
        reason: 'STREAK_MILESTONE_REWARD',
        amount: 200,
        referenceType: 'streak',
        metadata: { days: 7 },
      },
      {
        reason: 'DAILY_CHALLENGE_REWARD',
        amount: 500,
        referenceType: 'daily_challenge',
        metadata: { challengeDate: 'weekly-streak' },
      },
    ],
  },
  {
    username: 'content_author',
    balance: 1200,
    transactions: [
      {
        reason: 'ADMIN_ADJUSTMENT',
        amount: 1000,
        referenceType: 'admin',
        metadata: { note: 'Creator welcome bonus' },
      },
      {
        reason: 'QUIZ_COMPLETION_REWARD',
        amount: 200,
        referenceType: 'quiz',
        metadata: { title: 'Author test run', scorePercent: 100 },
      },
    ],
  },
  {
    username: 'admin_master',
    balance: 10000,
    transactions: [
      {
        reason: 'ADMIN_ADJUSTMENT',
        amount: 10000,
        referenceType: 'admin',
        metadata: { note: 'Admin reserve wallet' },
      },
    ],
  },
  {
    username: 'community_moderator',
    balance: 500,
    transactions: [
      {
        reason: 'ADMIN_ADJUSTMENT',
        amount: 500,
        referenceType: 'admin',
        metadata: { note: 'Moderator stipend' },
      },
    ],
  },
];

export const runWalletSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  let insertedWallets = 0;
  let insertedTxs = 0;

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    for (const seed of WALLET_SEEDS) {
      const userId = await lookup.userIdByUsername(seed.username);

      const [existingWallet] = await tx
        .select({ userId: userWallets.userId })
        .from(userWallets)
        .where(eq(userWallets.userId, userId))
        .limit(1);

      if (existingWallet) {
        await tx
          .update(userWallets)
          .set({
            balance: seed.balance,
            updatedAt: ctx.nowIso,
          })
          .where(eq(userWallets.userId, userId));
      } else {
        await tx.insert(userWallets).values({
          userId,
          balance: seed.balance,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        });
        insertedWallets++;
      }

      let runningBalance = 0;
      for (let i = 0; i < seed.transactions.length; i++) {
        const item = seed.transactions[i];
        runningBalance += item.amount;
        const idempotencyKey = `seed:wallet:${seed.username}:tx_${i + 1}`;

        const [existingTx] = await tx
          .select({ transactionId: coinTransactions.transactionId })
          .from(coinTransactions)
          .where(eq(coinTransactions.idempotencyKey, idempotencyKey))
          .limit(1);

        if (!existingTx) {
          await tx.insert(coinTransactions).values({
            userId,
            reason: item.reason,
            amount: item.amount,
            balanceAfter: runningBalance,
            referenceType: item.referenceType,
            referenceId: item.referenceId,
            idempotencyKey,
            metadata: item.metadata,
            createdAt: ctx.nowIso,
          });
          insertedTxs++;
        }
      }

      logger.info(`Seeded wallet for "${seed.username}" (balance: ${seed.balance}, transactions: ${seed.transactions.length})`);
    }
  });

  return [
    { domain: 'user_wallets', inserted: insertedWallets, updated: 0, skipped: 0 },
    { domain: 'coin_transactions', inserted: insertedTxs, updated: 0, skipped: 0 },
  ];
};
