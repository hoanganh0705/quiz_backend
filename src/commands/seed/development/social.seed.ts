import { and, eq } from 'drizzle-orm';
import { db, type SeedContext } from '../infrastructure';
import { SeedLookup } from '../shared/seed-lookup';
import {
  friendships,
  userFollows,
  socialFeedActivities,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';
import type { SeedSummary } from '../infrastructure/types';

export const runSocialSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  let insertedFriendships = 0;
  let insertedFollows = 0;
  let insertedActivities = 0;

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    const learnerId = await lookup.userIdByUsername('learner_user');
    const powerId = await lookup.userIdByUsername('power_user');
    const authorId = await lookup.userIdByUsername('content_author');
    const moderatorId = await lookup.userIdByUsername('community_moderator');
    const adminId = await lookup.userIdByUsername('admin_master');

    // 1. Friendships
    const friendshipPairs = [
      { requesterId: learnerId, addresseeId: powerId, status: 'accepted' as const },
      { requesterId: learnerId, addresseeId: authorId, status: 'accepted' as const },
      { requesterId: moderatorId, addresseeId: learnerId, status: 'pending' as const },
      { requesterId: learnerId, addresseeId: adminId, status: 'pending' as const },
    ];

    for (const pair of friendshipPairs) {
      const [existing] = await tx
        .select({ friendshipId: friendships.friendshipId })
        .from(friendships)
        .where(
          and(
            eq(friendships.requesterId, pair.requesterId),
            eq(friendships.addresseeId, pair.addresseeId),
          ),
        )
        .limit(1);

      if (!existing) {
        await tx.insert(friendships).values({
          requesterId: pair.requesterId,
          addresseeId: pair.addresseeId,
          status: pair.status,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        });
        insertedFriendships++;
      }
    }

    // 2. User Follows
    const followPairs = [
      { followerId: learnerId, followingId: authorId },
      { followerId: powerId, followingId: authorId },
      { followerId: learnerId, followingId: powerId },
      { followerId: authorId, followingId: powerId },
    ];

    for (const pair of followPairs) {
      const [existing] = await tx
        .select({ followId: userFollows.followId })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followerId, pair.followerId),
            eq(userFollows.followingId, pair.followingId),
          ),
        )
        .limit(1);

      if (!existing) {
        await tx.insert(userFollows).values({
          followerId: pair.followerId,
          followingId: pair.followingId,
          createdAt: ctx.nowIso,
        });
        insertedFollows++;
      }
    }

    // 3. Social Feed Activities
    const activities = [
      {
        userId: powerId,
        activityType: 'quiz_completed' as const,
        payload: {
          quizTitle: 'JavaScript Fundamentals',
          quizSlug: 'javascript-fundamentals',
          scorePercent: 100,
          xpEarned: 100,
        },
      },
      {
        userId: powerId,
        activityType: 'badge_earned' as const,
        payload: {
          badgeName: 'Quiz Master',
          badgeSlug: 'hundred-quizzes',
          tier: 'gold',
        },
      },
      {
        userId: authorId,
        activityType: 'tournament_won' as const,
        payload: {
          tournamentTitle: 'April System Design Cup',
          prize: '2000 XP + Champion Badge',
        },
      },
      {
        userId: learnerId,
        activityType: 'badge_earned' as const,
        payload: {
          badgeName: 'First Steps',
          badgeSlug: 'first-quiz',
          tier: 'bronze',
        },
      },
      {
        userId: learnerId,
        activityType: 'quiz_completed' as const,
        payload: {
          quizTitle: 'World History Chronicles',
          quizSlug: 'world-history-chronicles',
          scorePercent: 100,
          xpEarned: 100,
        },
      },
    ];

    for (const act of activities) {
      await tx.insert(socialFeedActivities).values({
        userId: act.userId,
        activityType: act.activityType,
        payload: act.payload,
        occurredAt: ctx.nowIso,
        createdAt: ctx.nowIso,
      });
      insertedActivities++;
    }

    logger.info(
      `Seeded social domain (friendships: ${insertedFriendships}, follows: ${insertedFollows}, activities: ${insertedActivities})`,
    );
  });

  return [
    { domain: 'friendships', inserted: insertedFriendships, updated: 0, skipped: 0 },
    { domain: 'user_follows', inserted: insertedFollows, updated: 0, skipped: 0 },
    { domain: 'social_feed_activities', inserted: insertedActivities, updated: 0, skipped: 0 },
  ];
};
