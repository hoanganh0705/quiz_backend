/**
 * GraphQL object types for the user profile surface.
 *
 * These describe the transport shape only. Auth-gated fields are declared
 * nullable so a single query can serve both a signed-in and a signed-out
 * reader; the resolvers return `null` rather than failing the whole request.
 */
import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { LevelTitle } from '@/modules/user/domain/types/level.types';

registerEnumType(LevelTitle, {
  name: 'LevelTitle',
  description: 'Qualitative band for a user’s current level.',
});

@ObjectType('UserPageInfo', { description: 'Cursor position within a result set' })
export class UserPageInfoGql {
  @Field(() => Int, { description: 'Page size that was applied' })
  limit!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Cursor for the next page. Null when this is the final page.',
  })
  nextCursor!: string | null;

  @Field(() => Boolean, { description: 'Whether more items exist after this page' })
  hasNextPage!: boolean;
}

@ObjectType('UserSummary')
export class UserSummaryGql {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  displayName!: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;

  @Field(() => String, { nullable: true })
  bio!: string | null;

  @Field(() => String, { nullable: true })
  country!: string | null;

  @Field(() => String, { nullable: true })
  countryCode!: string | null;

  @Field(() => String, { nullable: true })
  bgImageUrl!: string | null;

  @Field(() => String, { description: 'Account creation timestamp (ISO 8601)' })
  createdAt!: string;

  @Field(() => String, { description: 'Last write to the user row (ISO 8601)' })
  updatedAt!: string;

  @Field(() => Int, { description: 'Total experience points earned' })
  xpTotal!: number;

  @Field(() => Int, { description: 'Current 1-indexed level' })
  level!: number;

  @Field(() => Int, { description: 'XP required to enter the current level' })
  currentLevelXP!: number;

  @Field(() => Int, { description: 'XP required to enter the next level' })
  nextLevelXP!: number;

  @Field(() => Float, { description: 'Progress through the current level, 0 to 100' })
  xpProgressPercent!: number;

  @Field(() => LevelTitle)
  levelTitle!: LevelTitle;

  @Field(() => String, {
    description: 'Locale-aware label for levelTitle, negotiated from the request locale.',
  })
  levelTitleLocalised!: string;

  @Field(() => Int, { description: 'Current daily quiz streak' })
  currentStreak!: number;

  @Field(() => Int, { description: 'Longest daily quiz streak ever' })
  longestStreak!: number;

  @Field(() => Int, { description: 'Quizzes authored by this user' })
  quizzesCreated!: number;

  @Field(() => Int, { description: 'Authored quizzes that are currently published' })
  quizzesPublished!: number;

  @Field(() => Int, { description: 'Unique quizzes this user has completed' })
  quizzesTaken!: number;

  @Field(() => Int, { description: 'Accounts following this user' })
  followers!: number;

  @Field(() => Int, { description: 'Accounts this user follows' })
  following!: number;

  @Field(() => Int, { description: 'Mutual friends' })
  friends!: number;

  @Field(() => Int, { description: 'Cached coin balance' })
  coinBalance!: number;
}

@ObjectType('UserAnalyticsTotals')
export class UserAnalyticsTotalsGql {
  @Field(() => Int)
  totalAttempts!: number;

  @Field(() => Int)
  completedQuizzes!: number;

  @Field(() => Float, { description: 'Average score percent across attempts' })
  averageScore!: number;
}

@ObjectType('UserAnalyticsFavorite')
export class UserAnalyticsFavoriteGql {
  @Field(() => String, { description: 'Category or tag identifier' })
  id!: string;

  @Field(() => String)
  name!: string;
}

@ObjectType('UserAnalytics')
export class UserAnalyticsGql {
  @Field(() => String)
  userId!: string;

  @Field(() => UserAnalyticsTotalsGql)
  summary!: UserAnalyticsTotalsGql;

  @Field(() => UserAnalyticsFavoriteGql, { nullable: true })
  favoriteCategory!: UserAnalyticsFavoriteGql | null;

  @Field(() => UserAnalyticsFavoriteGql, { nullable: true })
  favoriteTag!: UserAnalyticsFavoriteGql | null;

  @Field(() => String, { description: 'ISO 8601 timestamp of the last refresh' })
  lastUpdated!: string;
}

@ObjectType('UserXpPoint')
export class UserXpPointGql {
  @Field(() => String, { description: 'Point timestamp (ISO 8601)' })
  date!: string;

  @Field(() => Int)
  value!: number;
}

@ObjectType('UserXpHistory')
export class UserXpHistoryGql {
  @Field(() => String, { description: 'Series bucket: day, week, or month' })
  bucket!: string;

  @Field(() => String, { description: 'Series unit label' })
  unit!: string;

  @Field(() => [UserXpPointGql])
  points!: UserXpPointGql[];
}

@ObjectType('UserActivityItem')
export class UserActivityItemGql {
  @Field(() => String)
  eventId!: string;

  @Field(() => String, { description: 'Event type, for example attempt_completed' })
  eventType!: string;

  @Field(() => String, { description: 'ISO 8601 creation timestamp' })
  createdAt!: string;

  @Field(() => [String], {
    nullable: true,
    description:
      'Metadata keys attached to the event. Values are arbitrary, so only the keys are exposed.',
  })
  metadataKeys!: string[] | null;
}

@ObjectType('UserCoinWallet')
export class UserCoinWalletGql {
  @Field(() => Int)
  balance!: number;

  @Field(() => String, { description: 'ISO 8601 creation timestamp' })
  createdAt!: string;

  @Field(() => String, { description: 'ISO 8601 last-update timestamp' })
  updatedAt!: string;

  @Field(() => String, { nullable: true, description: 'ISO 8601 timestamp of the last movement' })
  lastTransactionAt!: string | null;

  @Field(() => Int, { description: 'Coins earned today' })
  earnedToday!: number;

  @Field(() => Int, { description: 'Maximum coins earnable per day' })
  dailyEarnCap!: number;
}

@ObjectType('SocialConnection', { description: 'A follower or following entry' })
export class SocialConnectionGql {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;

  @Field(() => String, { description: 'ISO 8601 timestamp the follow was created' })
  followedAt!: string;
}

@ObjectType('SocialConnectionConnection', {
  description: 'A page of followers or following entries.',
})
export class SocialConnectionConnectionGql {
  @Field(() => [SocialConnectionGql])
  items!: SocialConnectionGql[];

  @Field(() => UserPageInfoGql)
  pageInfo!: UserPageInfoGql;
}

@ObjectType('ActivityActor')
export class ActivityActorGql {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  displayName!: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;
}

@ObjectType('SocialActivityItem')
export class SocialActivityItemGql {
  @Field(() => String)
  id!: string;

  @Field(() => String, { description: 'Activity type, for example attempt_completed' })
  type!: string;

  @Field(() => String, { description: 'ISO 8601 timestamp the activity occurred' })
  occurredAt!: string;

  @Field(() => ActivityActorGql, { nullable: true })
  actor!: ActivityActorGql | null;
}

@ObjectType('SocialActivityConnection')
export class SocialActivityConnectionGql {
  @Field(() => [SocialActivityItemGql])
  items!: SocialActivityItemGql[];

  @Field(() => UserPageInfoGql)
  pageInfo!: UserPageInfoGql;
}

@ObjectType('UserProfile', {
  description: 'A public user profile. Auth-gated fields resolve to null for anonymous callers.',
})
export class UserProfileGql {
  @Field(() => UserSummaryGql)
  summary!: UserSummaryGql;

  @Field(() => UserAnalyticsGql, {
    nullable: true,
    description: 'Requires authentication. Null for anonymous callers.',
  })
  analytics!: UserAnalyticsGql | null;

  @Field(() => UserXpHistoryGql, {
    nullable: true,
    description: 'Requires authentication. Null for anonymous callers.',
  })
  xpHistory!: UserXpHistoryGql | null;

  @Field(() => [UserActivityItemGql], {
    nullable: true,
    description: 'Requires authentication. Null for anonymous callers.',
  })
  recentActivity!: UserActivityItemGql[] | null;

  @Field(() => UserCoinWalletGql, {
    nullable: true,
    description: 'Only populated on the signed-in user’s own profile.',
  })
  wallet!: UserCoinWalletGql | null;

  @Field(() => SocialConnectionConnectionGql, {
    nullable: true,
    description: 'Requires authentication. Null for anonymous callers.',
  })
  followers!: SocialConnectionConnectionGql | null;

  @Field(() => SocialConnectionConnectionGql, {
    nullable: true,
    description: 'Requires authentication. Null for anonymous callers.',
  })
  following!: SocialConnectionConnectionGql | null;

  @Field(() => SocialActivityConnectionGql, {
    nullable: true,
    description: 'Requires authentication. Null when the timeline is private.',
  })
  activity!: SocialActivityConnectionGql | null;
}
