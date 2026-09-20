import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, passwordHistory } from '@/core/database/schema';
import { USER_IDENTITY_COLUMNS, type CreatedUserRow } from './user.types';

@Injectable()
export class UserRegistrationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createUser(email: string, username: string, passwordHash: string): Promise<CreatedUserRow> {
    const [createdUser] = await this.db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
      })
      .returning({
        ...USER_IDENTITY_COLUMNS,
        createdAt: users.createdAt,
        isVerified: users.isVerified,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user');
      });

    return createdUser as CreatedUserRow;
  }

  async createUserWithPasswordHistory(params: {
    email: string;
    username: string;
    passwordHash: string;
    nowIso: string;
  }): Promise<CreatedUserRow> {
    const createdUser = await this.db
      .transaction(async (tx) => {
        const [inserted] = await tx
          .insert(users)
          .values({
            email: params.email,
            username: params.username,
            passwordHash: params.passwordHash,
          })
          .returning({
            ...USER_IDENTITY_COLUMNS,
            createdAt: users.createdAt,
            isVerified: users.isVerified,
          });

        if (!inserted) {
          throw new InternalServerErrorException('Failed to create user');
        }

        await tx.insert(passwordHistory).values({
          userId: inserted.userId,
          passwordHash: params.passwordHash,
          createdAt: params.nowIso,
        });

        return inserted as CreatedUserRow;
      })
      .catch((error: unknown) => {
        if (error instanceof InternalServerErrorException) {
          throw error;
        }
        throw new InternalServerErrorException('Failed to create user');
      });

    return createdUser;
  }
}
