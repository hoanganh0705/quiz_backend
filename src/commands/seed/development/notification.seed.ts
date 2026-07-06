import { db, type SeedContext, recorder } from '../infrastructure';
import type { SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  notificationPreferences,
  notifications,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

type NotificationSeed = {
  notificationId: string;
  username: string;
  type:
    | 'achievement_earned'
    | 'badge_unlocked'
    | 'rank_achievement'
    | 'rank_improvement'
    | 'discussion_reply'
    | 'discussion_solved'
    | 'quiz_review_received'
    | 'weekly_summary'
    | 'system_announcement';
  title: string;
  message: string;
  channel: 'in_app' | 'email' | 'push';
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

type NotificationPreferenceSeed = {
  username: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  achievementEnabled: boolean;
  tournamentEnabled: boolean;
  rankEnabled: boolean;
  friendEnabled: boolean;
  discussionEnabled: boolean;
  summaryEnabled: boolean;
  marketingEnabled: boolean;
  rankImprovementThreshold: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

const NOTIFICATION_SEEDS: NotificationSeed[] = [
  {
    notificationId: '61111111-1111-7111-8111-111111111111',
    username: 'power_user',
    type: 'rank_achievement',
    title: 'You are #1!',
    message: 'You climbed to rank #1 on the global leaderboard. Keep the momentum going.',
    channel: 'in_app',
    isRead: false,
    createdAt: '2026-06-30T10:05:00.000Z',
    metadata: { period: 'all_time', rank: 1 },
  },
  {
    notificationId: '61111111-1111-7111-8111-111111111112',
    username: 'power_user',
    type: 'badge_unlocked',
    title: 'Badge Unlocked',
    message: 'You unlocked the "Champion" badge for reaching rank #1 globally.',
    channel: 'in_app',
    isRead: true,
    createdAt: '2026-06-30T10:06:00.000Z',
    readAt: '2026-06-30T10:10:00.000Z',
    metadata: { badgeSlug: 'rank-1', badgeName: 'Champion' },
  },
  {
    notificationId: '62222222-2222-7222-8222-222222222221',
    username: 'learner_user',
    type: 'discussion_reply',
    title: 'New Reply On Your Thread',
    message: 'Someone replied to your discussion about `typeof null`.',
    channel: 'in_app',
    isRead: false,
    createdAt: '2026-06-30T09:00:00.000Z',
    metadata: {
      threadId: '11111111-1111-7111-8111-111111111111',
      commentId: '11111111-1111-7111-8111-111111111112',
    },
  },
  {
    notificationId: '62222222-2222-7222-8222-222222222222',
    username: 'learner_user',
    type: 'achievement_earned',
    title: 'New Achievement Earned',
    message: 'You earned the "Point Collector" badge for reaching 100 XP.',
    channel: 'in_app',
    isRead: true,
    createdAt: '2026-06-29T08:35:00.000Z',
    readAt: '2026-06-29T09:00:00.000Z',
    metadata: { badgeSlug: 'xp-100', xpTotal: 100 },
  },
  {
    notificationId: '63333333-3333-7333-8333-333333333331',
    username: 'content_author',
    type: 'quiz_review_received',
    title: 'Your Quiz Got A New Review',
    message: 'A learner left a 5-star review on "JavaScript Fundamentals".',
    channel: 'in_app',
    isRead: false,
    createdAt: '2026-06-29T12:00:00.000Z',
    metadata: { quizSlug: 'javascript-fundamentals', rating: 5 },
  },
  {
    notificationId: '63333333-3333-7333-8333-333333333332',
    username: 'content_author',
    type: 'weekly_summary',
    title: 'Weekly Summary Ready',
    message: 'Your weekly creator summary is ready with new quiz attempts, reviews, and discussion activity.',
    channel: 'email',
    isRead: false,
    createdAt: '2026-06-30T07:00:00.000Z',
    expiresAt: '2026-07-07T07:00:00.000Z',
    metadata: { summaryType: 'creator', window: 'weekly' },
  },
  {
    notificationId: '64444444-4444-7444-8444-444444444441',
    username: 'admin_master',
    type: 'system_announcement',
    title: 'Seed Environment Ready',
    message: 'Development seed data has been prepared successfully for demos and QA flows.',
    channel: 'in_app',
    isRead: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-07-08T00:00:00.000Z',
    metadata: { environment: 'development' },
  },
];

const NOTIFICATION_PREFERENCE_SEEDS: NotificationPreferenceSeed[] = [
  {
    username: 'power_user',
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    achievementEnabled: true,
    tournamentEnabled: true,
    rankEnabled: true,
    friendEnabled: true,
    discussionEnabled: true,
    summaryEnabled: true,
    marketingEnabled: false,
    rankImprovementThreshold: 1,
    quietHoursStart: null,
    quietHoursEnd: null,
  },
  {
    username: 'learner_user',
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
    achievementEnabled: true,
    tournamentEnabled: true,
    rankEnabled: true,
    friendEnabled: true,
    discussionEnabled: true,
    summaryEnabled: true,
    marketingEnabled: false,
    rankImprovementThreshold: 3,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
  {
    username: 'content_author',
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
    achievementEnabled: true,
    tournamentEnabled: false,
    rankEnabled: true,
    friendEnabled: true,
    discussionEnabled: true,
    summaryEnabled: true,
    marketingEnabled: false,
    rankImprovementThreshold: 5,
    quietHoursStart: '23:00',
    quietHoursEnd: '06:30',
  },
  {
    username: 'admin_master',
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    achievementEnabled: true,
    tournamentEnabled: true,
    rankEnabled: true,
    friendEnabled: true,
    discussionEnabled: true,
    summaryEnabled: true,
    marketingEnabled: false,
    rankImprovementThreshold: 5,
    quietHoursStart: null,
    quietHoursEnd: null,
  },
];

export const runNotificationSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    let preferencesTouched = 0;
    let notificationsInserted = 0;
    let skipped = 0;

    for (const seed of NOTIFICATION_PREFERENCE_SEEDS) {
      const userId = await lookup.userIdByUsername(seed.username);

      await tx
        .insert(notificationPreferences)
        .values({
          userId,
          inAppEnabled: seed.inAppEnabled,
          emailEnabled: seed.emailEnabled,
          pushEnabled: seed.pushEnabled,
          achievementEnabled: seed.achievementEnabled,
          tournamentEnabled: seed.tournamentEnabled,
          rankEnabled: seed.rankEnabled,
          friendEnabled: seed.friendEnabled,
          discussionEnabled: seed.discussionEnabled,
          summaryEnabled: seed.summaryEnabled,
          marketingEnabled: seed.marketingEnabled,
          rankImprovementThreshold: seed.rankImprovementThreshold,
          quietHoursStart: seed.quietHoursStart,
          quietHoursEnd: seed.quietHoursEnd,
          updatedAt: ctx.nowIso,
          createdAt: ctx.nowIso,
        })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: {
            inAppEnabled: seed.inAppEnabled,
            emailEnabled: seed.emailEnabled,
            pushEnabled: seed.pushEnabled,
            achievementEnabled: seed.achievementEnabled,
            tournamentEnabled: seed.tournamentEnabled,
            rankEnabled: seed.rankEnabled,
            friendEnabled: seed.friendEnabled,
            discussionEnabled: seed.discussionEnabled,
            summaryEnabled: seed.summaryEnabled,
            marketingEnabled: seed.marketingEnabled,
            rankImprovementThreshold: seed.rankImprovementThreshold,
            quietHoursStart: seed.quietHoursStart,
            quietHoursEnd: seed.quietHoursEnd,
            updatedAt: ctx.nowIso,
          },
        });

      preferencesTouched++;
    }

    for (const seed of NOTIFICATION_SEEDS) {
      const userId = await lookup.userIdByUsername(seed.username);
      const inserted = await tx
        .insert(notifications)
        .values({
          notificationId: seed.notificationId,
          userId,
          type: seed.type,
          title: seed.title,
          message: seed.message,
          metadata: seed.metadata ?? {},
          channel: seed.channel,
          isRead: seed.isRead,
          readAt: seed.isRead ? seed.readAt ?? seed.createdAt : null,
          expiresAt: seed.expiresAt ?? null,
          createdAt: seed.createdAt,
          deletedAt: null,
        })
        .onConflictDoNothing()
        .returning({ notificationId: notifications.notificationId });

      // Record the seeded notification so SEED_RECORD.md lists every entry
// that the seed defines — even on re-runs where the row already exists.
      recorder.record({
        kind: 'Notifications',
        id: seed.notificationId,
        fields: {
          notificationId: seed.notificationId,
          username: seed.username,
          type: seed.type,
          channel: seed.channel,
          title: seed.title,
          isRead: String(seed.isRead),
        },
      });

      if (inserted.length === 0) {
        skipped++;
        continue;
      }

      notificationsInserted += inserted.length;
      logger.info(`Notification seeded: ${seed.type} for ${seed.username}`);
    }

    summaries.push({
      domain: 'notifications',
      inserted: preferencesTouched + notificationsInserted,
      updated: 0,
      skipped,
    });
  });

  return summaries;
};
