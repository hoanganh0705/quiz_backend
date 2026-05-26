import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UserRepositoryPort } from './domain/ports/user-repository.port';
import { USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';
import { UpdateMeDto } from './dto/request/update-me.dto';
import { UpdateMeSettingsDto } from './dto/request/update-me-settings.dto';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { normalizeNullableText } from '@/common/utils/text.util';
import { hasOwn, isObjectRecord } from '@/common/utils/object.util';
import type { UserMeRow } from './domain/ports/user-repository.port';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  private toUserMeResponse(user: UserMeRow): UserMeResponseDto {
    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      xpTotal: user.xpTotal,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      settings: isObjectRecord(user.settings) ? user.settings : {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async getActiveUserById(userId: string): Promise<UserMeResponseDto> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserMeResponse(user);
  }

  async getMeById(userId: string): Promise<UserMeResponseDto> {
    return this.getActiveUserById(userId);
  }

  async updateMeById(userId: string, payload: UpdateMeDto): Promise<UserMeResponseDto> {
    const profilePatch: {
      displayName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (hasOwn(payload, 'displayName')) {
      profilePatch.displayName = normalizeNullableText(payload.displayName);
    }

    if (hasOwn(payload, 'bio')) {
      profilePatch.bio = normalizeNullableText(payload.bio);
    }

    if (hasOwn(payload, 'avatarUrl')) {
      profilePatch.avatarUrl = normalizeNullableText(payload.avatarUrl);
    }

    if (Object.keys(profilePatch).length === 0) {
      return this.getActiveUserById(userId);
    }

    const nowIso = new Date().toISOString();
    const updatedUser = await this.userRepository.updateProfile(userId, profilePatch, nowIso);

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.toUserMeResponse(updatedUser);
  }

  async updateMeSettingsById(
    userId: string,
    payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    if (!isObjectRecord(payload.settings)) {
      throw new BadRequestException('settings must be an object');
    }

    const nowIso = new Date().toISOString();
    const updatedUser = await this.userRepository.updateSettings(userId, payload.settings, nowIso);

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.toUserMeResponse(updatedUser);
  }
}
