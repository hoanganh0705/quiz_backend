import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { users } from '../../core/database/schema';
import { UpdateMeDto } from './dto/request/update-me.dto';
import { UpdateMeSettingsDto } from './dto/request/update-me-settings.dto';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private normalizeNullableText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private async getActiveUserById(userId: string): Promise<UserMeResponseDto> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        xpTotal: users.xpTotal,
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
        settings: users.settings,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      settings: user.settings as Record<string, unknown>,
    };
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

    if (Object.prototype.hasOwnProperty.call(payload, 'displayName')) {
      profilePatch.displayName = this.normalizeNullableText(payload.displayName);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'bio')) {
      profilePatch.bio = this.normalizeNullableText(payload.bio);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'avatarUrl')) {
      profilePatch.avatarUrl = this.normalizeNullableText(payload.avatarUrl);
    }

    if (Object.keys(profilePatch).length === 0) {
      return this.getActiveUserById(userId);
    }

    await this.db
      .update(users)
      .set({
        ...profilePatch,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)));

    return this.getActiveUserById(userId);
  }

  async updateMeSettingsById(
    userId: string,
    payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    const user = await this.getActiveUserById(userId);
    const mergedSettings = {
      ...user.settings,
      ...payload.settings,
    };

    await this.db
      .update(users)
      .set({
        settings: mergedSettings,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)));

    return this.getActiveUserById(userId);
  }
}
