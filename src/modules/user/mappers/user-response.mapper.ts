import type { UserMeRow } from '../domain/ports/user-repository.port';
import type { UserMeResponseDto } from '../dto/response/user-me-response.dto';
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
}
