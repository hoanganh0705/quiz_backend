import { Injectable } from '@nestjs/common';

import { UserSummaryResponseDto } from '../dto/response/user-summary.dto';
import { UserAnalyticsResponseDto } from '../dto/response/user-analytics.dto';
import { UserActivityItemDto } from '../dto/response/user-activity.dto';
import { UserApplicationService } from './user.application.service';

@Injectable()
export class UserSummaryService {
  constructor(private readonly userApplicationService: UserApplicationService) {}

  async getSummary(
    targetUserId: string,
    requesterId: string,
    acceptLanguage?: string,
  ): Promise<UserSummaryResponseDto> {
    return this.userApplicationService.getMySummary(targetUserId, acceptLanguage);
  }

  async getAnalytics(targetUserId: string, requesterId: string): Promise<UserAnalyticsResponseDto> {
    return this.userApplicationService.getUserAnalytics(targetUserId, requesterId);
  }

  async getRecentActivity(
    targetUserId: string,
    _requesterId: string,
    limit: number,
  ): Promise<UserActivityItemDto[]> {
    const result = await this.userApplicationService.listMyActivity(targetUserId, { limit });
    return result.items ?? [];
  }
}
