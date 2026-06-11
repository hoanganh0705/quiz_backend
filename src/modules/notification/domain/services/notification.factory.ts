import { NotificationType } from '../types/notification.types';

export class NotificationFactory {
  static createFollowed(params: {
    followerId: string;
    followerUsername?: string;
    followId: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'followed',
      title: 'New Follower',
      message: `${params.followerUsername ?? 'Someone'} followed you`,
      metadata: {
        followerId: params.followerId,
        followerUsername: params.followerUsername,
        followId: params.followId,
      },
    };
  }

  static createFriendRequest(params: {
    requesterId: string;
    requesterUsername?: string;
    friendshipId: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${params.requesterUsername ?? 'Someone'} sent you a friend request`,
      metadata: {
        requesterId: params.requesterId,
        requesterUsername: params.requesterUsername,
        friendshipId: params.friendshipId,
      },
    };
  }

  static createFriendAccepted(params: {
    addresseeId: string;
    addresseeUsername?: string;
    friendshipId: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${params.addresseeUsername ?? 'Someone'} accepted your friend request`,
      metadata: {
        addresseeId: params.addresseeId,
        addresseeUsername: params.addresseeUsername,
        friendshipId: params.friendshipId,
      },
    };
  }

  static createDiscussionReply(params: {
    actorId: string;
    actorUsername?: string;
    threadId: string;
    commentId: string;
    parentCommentId?: string | null;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'discussion_reply',
      title: 'New Reply',
      message: `${params.actorUsername ?? 'Someone'} replied to your discussion`,
      metadata: {
        actorId: params.actorId,
        actorUsername: params.actorUsername,
        discussionId: params.threadId,
        commentId: params.commentId,
        parentCommentId: params.parentCommentId,
      },
    };
  }

  static createDiscussionMention(params: {
    actorId: string;
    actorUsername?: string;
    threadId: string;
    commentId: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'discussion_mention',
      title: 'You Were Mentioned',
      message: `${params.actorUsername ?? 'Someone'} mentioned you in a discussion`,
      metadata: {
        actorId: params.actorId,
        actorUsername: params.actorUsername,
        discussionId: params.threadId,
        commentId: params.commentId,
      },
    };
  }

  static createDiscussionSolved(params: {
    threadId: string;
    commentId: string;
    solverId: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'discussion_solved',
      title: 'Discussion Solved',
      message: 'Your discussion was marked as solved',
      metadata: {
        discussionId: params.threadId,
        commentId: params.commentId,
        solverId: params.solverId,
      },
    };
  }

  static createBadgeEarned(params: { badgeType: string; badgeName?: string }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'badge_earned',
      title: 'Badge Earned',
      message: `You earned the "${params.badgeName ?? params.badgeType}" badge`,
      metadata: {
        badgeId: params.badgeType,
        badgeName: params.badgeName,
      },
    };
  }

  static createTournamentStarted(params: { tournamentId: string; tournamentTitle?: string }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'tournament_started',
      title: 'Tournament Started',
      message: `${params.tournamentTitle ?? 'A tournament'} has started`,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
      },
    };
  }

  static createTournamentReminder(params: {
    tournamentId: string;
    tournamentTitle?: string;
    startsAt?: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'tournament_reminder',
      title: 'Tournament Reminder',
      message: `${params.tournamentTitle ?? 'A tournament'} starts tomorrow`,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        startsAt: params.startsAt,
      },
    };
  }

  static createTournamentWon(params: {
    tournamentId: string;
    tournamentTitle?: string;
    prize?: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'tournament_won',
      title: 'Tournament Champion!',
      message: params.prize
        ? `You won ${params.tournamentTitle ?? 'the tournament'}! Prize: ${params.prize}`
        : `You won ${params.tournamentTitle ?? 'the tournament'}!`,
      metadata: {
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        prize: params.prize,
      },
    };
  }

  static createRankImproved(params: {
    previousRank: number;
    newRank: number;
    improvement: number;
    period: string;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'rank_improved',
      title: `+${params.improvement} positions!`,
      message: `You moved from rank #${params.previousRank} to rank #${params.newRank}.`,
      metadata: {
        previousRank: params.previousRank,
        newRank: params.newRank,
        improvement: params.improvement,
        period: params.period,
      },
    };
  }

  static createRankMilestone(params: {
    rank: number;
    period: string;
    milestone: string;
    percentile?: number;
  }): {
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    return {
      type: 'rank_milestone',
      title: 'Rank Milestone!',
      message: `You reached a new ranking milestone at #${params.rank}.`,
      metadata: {
        rank: params.rank,
        period: params.period,
        milestone: params.milestone,
        percentile: params.percentile,
      },
    };
  }
}
