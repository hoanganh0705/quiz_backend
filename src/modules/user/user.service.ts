import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '@/core/database/database.module';
import { users } from '@/core/database/schema';
import { UpdateMeDto } from './dto/request/update-me.dto';
import { UpdateMeSettingsDto } from './dto/request/update-me-settings.dto';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { normalizeNullableText } from '@/common/utils/text.util';

type UserMeRow = {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
};

const USER_ME_COLUMNS = {
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
};

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private isObjectRecord(value: unknown): value is Record<string, unknown> {
    return (
      Object.prototype.toString.call(value) === '[object Object]' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

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
      settings: this.isObjectRecord(user.settings) ? user.settings : {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async getActiveUserById(userId: string): Promise<UserMeResponseDto> {
    const [user] = await this.db
      .select(USER_ME_COLUMNS)
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserMeResponse(user as UserMeRow);
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
      profilePatch.displayName = normalizeNullableText(payload.displayName);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'bio')) {
      profilePatch.bio = normalizeNullableText(payload.bio);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'avatarUrl')) {
      profilePatch.avatarUrl = normalizeNullableText(payload.avatarUrl);
    }

    if (Object.keys(profilePatch).length === 0) {
      return this.getActiveUserById(userId);
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        ...profilePatch,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .returning(USER_ME_COLUMNS);

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.toUserMeResponse(updatedUser as UserMeRow);
  }

  async updateMeSettingsById(
    userId: string,
    payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    if (!this.isObjectRecord(payload.settings)) {
      throw new BadRequestException('settings must be an object');
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        // Merge in DB to keep the operation atomic and avoid lost updates under concurrent writes.
        settings: sql`${users.settings} || ${JSON.stringify(payload.settings)}::jsonb`,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .returning(USER_ME_COLUMNS);

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.toUserMeResponse(updatedUser as UserMeRow);
  }
}
