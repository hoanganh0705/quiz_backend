import { Inject, Injectable } from '@nestjs/common';

import { STORAGE_PORT, type StoragePort } from '@/core/storage';
import type { UserLookupRow, UserMeRow } from '../domain/ports/user-repository.port';
import type { UserLookupResponseDto } from '../dto/response/user-lookup.dto';
import type { UserMeResponseDto } from '../dto/response/user-me.dto';
import { isObjectRecord } from '@/common/utils/object.util';

/**
 * Phase 6: the mapper is now an `@Injectable` so NestJS can wire
 * `STORAGE_PORT` into the constructor. The static helpers
 * (`toUserMeResponse`, `toUserLookupResponse`) became instance methods;
 * callers that previously imported the static helpers now go through
 * the `UserResponseMapper` token (provided by the user module). The
 * migration is mechanical: `UserResponseMapper.toUserMeResponse(row)`
 * becomes `this.mapper.toUserMeResponse(row)` inside application
 * services, and `UserResponseMapper.toUserLookupResponse(row)` becomes
 * `this.mapper.toUserLookupResponse(row)`.
 *
 * The mapper owns the "prefer new column, fall back to legacy" logic
 * for `avatarUrl` / `imageUrl`: if `avatarPublicId` is set, we
 * transform it into a stable Cloudinary delivery URL via
 * `STORAGE_PORT.deriveUrl`; otherwise we surface the legacy column
 * unchanged (Phase 7 migrate-on-write covers Base64 rows; legacy
 * external URLs continue to render).
 */
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

  /**
   * Phase 1 (S-1): identity projection returned by
   * `GET /users/by-username/:username`. The mapper only normalises
   * `nullable` joins (mirroring `toUserMeResponse`'s `displayName` /
   * `avatarUrl` handling); the rest is a direct copy.
   */
  toUserLookupResponse(row: UserLookupRow): UserLookupResponseDto {
    return {
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: this.deriveAvatarUrl(row.avatarPublicId, row.avatarUrl),
      isVerified: row.isVerified,
    };
  }

  /**
   * Phase 6: prefer the new Cloudinary column when set. Falls back to
   * the legacy column otherwise (Phase 7 migrate-on-write covers
   * Base64 rows; legacy external URLs continue to render as-is).
   */
  private deriveAvatarUrl(
    avatarPublicId: string | null,
    legacyAvatarUrl: string | null,
  ): string | null {
    if (avatarPublicId !== null) {
      return this.storage.deriveUrl(avatarPublicId, 'avatar');
    }
    return legacyAvatarUrl;
  }

  /**
   * Public variant of {@link deriveAvatarUrl} for callers (e.g. the
   * summary endpoint) that hand-roll a DTO projection and only need
   * the URL hydration step. Same semantics: prefer `avatarPublicId`,
   * fall back to legacy `avatarUrl`.
   */
  resolveAvatarUrl(avatarPublicId: string | null, legacyAvatarUrl: string | null): string | null {
    return this.deriveAvatarUrl(avatarPublicId, legacyAvatarUrl);
  }
}
