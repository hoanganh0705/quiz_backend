import { Inject, Injectable } from '@nestjs/common';

import { STORAGE_PORT, type StoragePort } from '@/core/storage';
import type { UserLookupRow, UserMeRow } from '../domain/ports/user-repository.port';
import type { UserLookupResponseDto } from '../dto/response/user-lookup.dto';
import type { UserMeResponseDto } from '../dto/response/user-me.dto';
import { isObjectRecord } from '@/common/utils/object.util';

@Injectable()
export class UserResponseMapper {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  toUserMeResponse(row: UserMeRow): UserMeResponseDto {
    return {
      userId: row.userId,
      username: row.username,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: this.deriveAvatarUrl(row.avatarPublicId, row.avatarUrl),
      bio: row.bio,
      xpTotal: row.xpTotal,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      settings: isObjectRecord(row.settings) ? row.settings : {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toUserLookupResponse(row: UserLookupRow): UserLookupResponseDto {
    return {
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: this.deriveAvatarUrl(row.avatarPublicId, row.avatarUrl),
      isVerified: row.isVerified,
    };
  }

  private deriveAvatarUrl(
    avatarPublicId: string | null,
    legacyAvatarUrl: string | null,
  ): string | null {
    if (avatarPublicId !== null) {
      return this.storage.deriveUrl(avatarPublicId, 'avatar');
    }
    return legacyAvatarUrl;
  }

  resolveAvatarUrl(avatarPublicId: string | null, legacyAvatarUrl: string | null): string | null {
    return this.deriveAvatarUrl(avatarPublicId, legacyAvatarUrl);
  }
}
