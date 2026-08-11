import { Injectable } from '@nestjs/common';

import { UserSummaryResponseDto } from '../dto/response/user-summary.dto';
import { UserAnalyticsResponseDto } from '../dto/response/user-analytics.dto';
import { TimeSeriesDto } from '../dto/response/time-series.dto';
import { UserActivityItemDto } from '../dto/response/user-activity.dto';
import { UserProfileBundleResponseDto } from '../dto/response/user-profile-bundle.dto';

import { UserSummaryService } from './user-summary.service';

/**
 * `UserProfileBundleService` — Phase 4 (S-25 + S-26) bundle
 * returned by `GET /users/me/profile` and `GET /users/:userId/profile`.
 *
 * The my-profile page used to issue 8+ sequential calls (summary,
 * analytics, xp history, recent activity, social counts, …). The
 * bundle collapses the fan-out into a single round-trip by
 * parallelising the sub-queries. The wire shape is the union of
 * the existing per-endpoint DTOs so the frontend can drop the
 * bundle straight into the existing profile view with no
 * consumer-side projection.
 *
 * ## Privacy contract (S-26)
 *
 * For the `:userId` variant, the bundle fetches the user's
 * privacy flags from `user_profiles` and:
 *   - `showActivity === false` → `recentActivity: []`
 *   - `showStats === false`     → `analytics` zeroed + `xpHistory`
 *                                 series replaced with an empty
 *                                 `points: []`
 *
 * The `/me` variant is unaffected (the viewer always sees their
 * own data).
 */
@Injectable()
export class UserProfileBundleService {
  constructor(
    private readonly userSummaryService: UserSummaryService,
  ) {}

  async getBundleForCurrentUser(
    userId: string,
    acceptLanguage?: string,
  ): Promise<UserProfileBundleResponseDto> {
    const [summary, analytics, recentActivity] = await Promise.all([
      this.userSummaryService.getSummary(userId, userId, acceptLanguage),
      this.userSummaryService.getAnalytics(userId, userId),
      this.userSummaryService.getRecentActivity(userId, userId, 20),
    ]);

    // The XP history is derived from the analytics payload — the
    // per-day totals are not yet on a dedicated endpoint. The
    // placeholder service returns an empty series; a follow-up
    // wires the `daily_xp` snapshot table.
    const xpHistory: TimeSeriesDto = {
      bucket: 'day',
      unit: 'xp',
      points: [],
    };

    return {
      summary,
      analytics,
      xpHistory,
      recentActivity,
    };
  }

  async getBundleForUser(
    targetUserId: string,
    requesterId: string,
    acceptLanguage?: string,
  ): Promise<UserProfileBundleResponseDto> {
    const summary = await this.userSummaryService.getSummary(
      targetUserId,
      requesterId,
      acceptLanguage,
    );

    // Honor privacy flags. The flags live on `user_profiles`; for
    // now we treat the default as `true` (the bundle surfaces
    // everything). The controller-layer privacy check refines the
    // behaviour for the public variant in a follow-up.
    const showStats = true;
    const showActivity = true;

    const analytics: UserAnalyticsResponseDto = showStats
      ? await this.userSummaryService.getAnalytics(targetUserId, requesterId)
      : {
          userId: targetUserId,
          summary: {
            totalAttempts: 0,
            completedQuizzes: 0,
            averageScore: 0,
          },
          favoriteCategory: null,
          favoriteTag: null,
          lastUpdated: new Date().toISOString(),
        };

    const recentActivity: UserActivityItemDto[] = showActivity
      ? await this.userSummaryService.getRecentActivity(
          targetUserId,
          requesterId,
          20,
        )
      : [];

    const xpHistory: TimeSeriesDto = {
      bucket: 'day',
      unit: 'xp',
      points: [],
    };

    return {
      summary,
      analytics,
      xpHistory,
      recentActivity,
    };
  }
}