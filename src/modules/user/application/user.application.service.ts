import { Injectable } from '@nestjs/common';
import { UserDomainService } from '../domain/user.service';
import { UserResponseMapper } from '../mappers/user-response.mapper';
import { UserBadgeCursorMapper } from '../mappers/user-badge-cursor.mapper';
import { UserAnalyticsResponseMapper } from '../mappers/user-analytics-response.mapper';
import { UpdateMeDto } from '../dto/request/update-me.dto';
import { UpdateMeSettingsDto } from '../dto/request/update-me-settings.dto';
import type { UserMeResponseDto } from '../dto/response/user-me-response.dto';
import type { UserBadgesResponseDto } from '../dto/response/user-badges-response.dto';
import type { UserRankingResponseDto } from '../dto/response/user-ranking-response.dto';
import type { UserAnalyticsResponseDto } from '../dto/response/user-analytics-response.dto';
import type {
  ListUserBadgesQuery,
  UpdateProfileCommand,
  UpdateSettingsCommand,
} from '../domain/types/user-commands';

@Injectable()
export class UserApplicationService {
  constructor(private readonly userDomainService: UserDomainService) {}

  async getMe(userId: string): Promise<UserMeResponseDto> {
    const row = await this.userDomainService.getMe(userId);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async listUserBadges(userId: string, query: ListUserBadgesQuery): Promise<UserBadgesResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.userDomainService.listUserBadges(
      userId,
      query,
    );

    return {
      items: items.map((item) => ({
        badgeId: item.badgeId,
        name: item.name,
        description: item.description,
        earnedAt: item.earnedAt,
      })),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? UserBadgeCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getUserRanking(userId: string): Promise<UserRankingResponseDto> {
    const summary = await this.userDomainService.getUserRanking(userId);
    return summary;
  }

  async getUserAnalytics(userId: string): Promise<UserAnalyticsResponseDto> {
    const analytics = await this.userDomainService.getUserAnalytics(userId);
    return UserAnalyticsResponseMapper.toResponse(analytics);
  }

  async updateProfile(userId: string, dto: UpdateMeDto): Promise<UserMeResponseDto> {
    const command: UpdateProfileCommand = {
      displayName: dto.displayName,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
    };
    const row = await this.userDomainService.updateProfile(userId, command);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async updateSettings(userId: string, dto: UpdateMeSettingsDto): Promise<UserMeResponseDto> {
    const command: UpdateSettingsCommand = {
      settings: dto.settings,
    };
    const row = await this.userDomainService.updateSettings(userId, command);
    return UserResponseMapper.toUserMeResponse(row);
  }
}
