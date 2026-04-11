import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../core/database/database.module';
import { users } from '../../../core/database/schema';

const USER_IDENTITY_COLUMNS = {
  userId: users.userId,
  username: users.username,
  email: users.email,
  role: users.role,
};

type UserIdentityRow = {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'creator' | 'user';
};

type UserWithPasswordRow = UserIdentityRow & {
  passwordHash: string;
};

type CreatedUserRow = UserIdentityRow & {
  createdAt: string;
};

@Injectable()
export class UserRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async ensureEmailAndUsernameAvailable(email: string, username: string): Promise<void> {
    const [existingUser] = await this.db
      .select({
        userId: users.userId,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), or(eq(users.email, email), eq(users.username, username))))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }
  }

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
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user');
      });

    return createdUser as CreatedUserRow;
  }

  async findActiveByEmailWithPassword(email: string): Promise<UserWithPasswordRow | null> {
    const [foundUser] = await this.db
      .select({
        ...USER_IDENTITY_COLUMNS,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, email)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    return (foundUser as UserWithPasswordRow | undefined) ?? null;
  }

  async findActiveIdentityById(userId: string): Promise<UserIdentityRow | null> {
    const [user] = await this.db
      .select(USER_IDENTITY_COLUMNS)
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    return (user as UserIdentityRow | undefined) ?? null;
  }
}
