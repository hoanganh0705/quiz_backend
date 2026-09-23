import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users } from '@/core/database/schema';
import type { UserVerificationRow, UserVerificationStatusRow } from './user.types';
import { notDeleted } from '@/common/database/soft-delete.helper';

@Injectable()
export class EmailVerificationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async setEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAtIso: string,
  ): Promise<void> {
    await this.db
      .update(users)
      .set({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAtIso,
      })
      .where(and(eq(users.userId, userId), notDeleted(users.deletedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to save email verification token');
      });
  }

  async findActiveVerificationStatusByEmail(
    email: string,
  ): Promise<UserVerificationStatusRow | null> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        email: users.email,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(and(notDeleted(users.deletedAt), eq(users.email, email)))
      .limit(1);

    return (user as UserVerificationStatusRow | undefined) ?? null;
  }

  async findUserByActiveVerificationToken(
    tokenHash: string,
    nowIso: string,
  ): Promise<UserVerificationRow | null> {
    // `isVerified = false` ensures token is one-time use: once verification succeeds,
    // user becomes verified and subsequent reuse attempts cannot match this query.
    const [user] = await this.db
      .select({
        userId: users.userId,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          notDeleted(users.deletedAt),
          eq(users.isVerified, false),
          eq(users.emailVerificationTokenHash, tokenHash),
          gt(users.emailVerificationExpiresAt, nowIso),
        ),
      )
      .limit(1);

    return (user as UserVerificationRow | undefined) ?? null;
  }

  async markEmailAsVerified(userId: string, nowIso: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        isVerified: true,
        emailVerifiedAt: nowIso,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      })
      .where(and(eq(users.userId, userId), notDeleted(users.deletedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to mark email as verified');
      });
  }
}
