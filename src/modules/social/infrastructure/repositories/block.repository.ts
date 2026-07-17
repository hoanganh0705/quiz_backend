import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { blockedUsers } from '@/core/database/schema';
import type { BlockRepositoryPort } from '../../domain/ports/block-ports';
import type { BlockedUser } from '../../domain/types/social.types';
import { eq, and, desc, count, sql, isNull } from 'drizzle-orm';

@Injectable()
export class BlockRepository implements BlockRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async blockUser(blockerId: string, blockedId: string, reason?: string): Promise<BlockedUser> {
    const result = await this.db.execute(sql<{
      blockId: string;
      blockerId: string;
      blockedId: string;
      reason: string | null;
      createdAt: string;
      deletedAt: string | null;
    }>`
      INSERT INTO blocked_users (blocker_id, blocked_id, reason, created_at)
      VALUES (
        ${blockerId}::uuid,
        ${blockedId}::uuid,
        ${reason ?? null},
        NOW()
      )
      ON CONFLICT (blocker_id, blocked_id) WHERE deleted_at IS NULL
      DO UPDATE SET reason = COALESCE(EXCLUDED.reason, blocked_users.reason)
      RETURNING
        block_id      AS "blockId",
        blocker_id    AS "blockerId",
        blocked_id    AS "blockedId",
        reason,
        created_at    AS "createdAt",
        deleted_at    AS "deletedAt"
    `);

    const row = result.rows[0] as
      | {
          blockId: string;
          blockerId: string;
          blockedId: string;
          reason: string | null;
          createdAt: string;
          deletedAt: string | null;
        }
      | undefined;

    if (!row) {
      throw new Error('blockUser: UPSERT returned no row');
    }

    return row as BlockedUser;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(blockedUsers)
      .set({ deletedAt: now })
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)));
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: count() })
      .from(blockedUsers)
      .where(
        and(
          eq(blockedUsers.blockerId, blockerId),
          eq(blockedUsers.blockedId, blockedId),
          isNull(blockedUsers.deletedAt),
        ),
      );

    return Number(result?.count ?? 0) > 0;
  }

  async getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
    const rows = await this.db
      .select()
      .from(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), isNull(blockedUsers.deletedAt)))
      .orderBy(desc(blockedUsers.createdAt));

    return rows as BlockedUser[];
  }
}
