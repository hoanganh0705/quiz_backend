import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { passwordHistory } from '@/core/database/schema';
import type { PasswordHistoryPort } from '../../domain/ports/password-history.port';

@Injectable()
export class PasswordHistoryAdapter implements PasswordHistoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getRecentPasswordHashes(userId: string, count: number): Promise<string[]> {
    const rows = await this.db
      .select({ passwordHash: passwordHistory.passwordHash })
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, userId))
      .orderBy(desc(passwordHistory.createdAt))
      .limit(count);

    return rows.map((row) => row.passwordHash);
  }

  async addPasswordToHistory(
    userId: string,
    passwordHash: string,
    nowIso: string,
    maxHistorySize: number,
  ): Promise<void> {
    // Race-condition fix: concurrent password changes for the same user can both insert
    // a history row and then prune. Without the lock, both transactions read the same
    // set of rows before either commits, causing over-pruning (valid entries deleted)
    // or under-pruning (more entries than maxHistorySize). pg_advisory_xact_lock is
    // transaction-scoped — it's acquired at start of the tx and released on commit/rollback.
    // Only concurrent calls for the SAME user serialize; different users proceed in parallel.
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

      await tx.insert(passwordHistory).values({
        userId,
        passwordHash,
        createdAt: nowIso,
      });

      const allEntries = await tx
        .select({ historyId: passwordHistory.historyId })
        .from(passwordHistory)
        .where(eq(passwordHistory.userId, userId))
        .orderBy(desc(passwordHistory.createdAt));

      if (allEntries.length > maxHistorySize) {
        const idsToDelete = allEntries.slice(maxHistorySize).map((e) => e.historyId);
        await tx.delete(passwordHistory).where(inArray(passwordHistory.historyId, idsToDelete));
      }
    });
  }
}
