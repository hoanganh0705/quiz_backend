import type { UserLookupRow, UserMeRow } from '../domain/ports/user-repository.port';
import type { UserLookupResponseDto } from '../dto/response/user-lookup.dto';
import type { UserMeResponseDto } from '../dto/response/user-me.dto';
import { isObjectRecord } from '@/common/utils/object.util';

export class UserResponseMapper {
  static toUserMeResponse(row: UserMeRow): UserMeResponseDto {
    return {
      userId: row.userId,
      username: row.username,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      xpTotal: row.xpTotal,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      settings: isObjectRecord(row.settings) ? row.settings : {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Phase 1 (S-1): identity projection returned by
   * `GET /users/by-username/:username`. The mapper only normalises
   * `nullable` joins (mirroring `toUserMeResponse`'s `displayName` /
   * `avatarUrl` handling); the rest is a direct copy.
   */
  static toUserLookupResponse(row: UserLookupRow): UserLookupResponseDto {
    return {
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      isVerified: row.isVerified,
    };
  }
}
