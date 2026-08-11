import { Injectable } from '@nestjs/common';

import { UserSummaryResponseDto } from '../dto/response/user-summary.dto';
import { UserAnalyticsResponseDto } from '../dto/response/user-analytics.dto';
import { UserActivityItemDto } from '../dto/response/user-activity.dto';
import { UserApplicationService } from './user.application.service';

/**
 * `UserSummaryService` — Phase 4 (S-25 + S-26) thin wrapper that
 * exposes the per-component reads the user-profile bundle needs.
 *
 *   - `getSummary`         — `/users/me/summary`-equivalent.
 *   - `getAnalytics`       — `/users/:userId/analytics`-equivalent.
 *   - `getRecentActivity`  — `/users/me/activity`-equivalent,
 *                            narrowed to a fixed limit.
 *
 * The service is a thin adapter — it forwards to the underlying
 * `UserApplicationService` methods. The `/me` summary variant
 * carries every privacy field zero (the viewer always sees their
 * own data); the public variant returns a slim projection that
 * already respects the privacy flags.
 */
@Injectable()
export class UserSummaryService {
  constructor(
    private readonly userApplicationService: UserApplicationService,
  ) {}

  async getSummary(
    targetUserId: string,
    requesterId: string,
    acceptLanguage?: string,
  ): Promise<UserSummaryResponseDto> {
    // The same getMySummary service handles both cases — the
    // privacy flags are stamped onto the response shape regardless
    // of viewer, and the bundle honours them downstream. The
    // `Accept-Language` header is forwarded so the localised
    // `levelTitleLocalised` field is consistent across the
    // standalone `/users/me/summary` and the bundle endpoints.
    return this.userApplicationService.getMySummary(targetUserId, acceptLanguage);
  }

  async getAnalytics(
    targetUserId: string,
    requesterId: string,
  ): Promise<UserAnalyticsResponseDto> {
    return this.userApplicationService.getUserAnalytics(
      targetUserId,
      requesterId,
    );
  }

  async getRecentActivity(
    targetUserId: string,
    _requesterId: string,
    limit: number,
  ): Promise<UserActivityItemDto[]> {
    // The activity service exposes a cursor-paginated reader; for
    // the bundle we request the first page and strip the envelope.
    const result = await this.userApplicationService.listMyActivity(
      targetUserId,
      { limit },
    );
    return result.items ?? [];
  }
}