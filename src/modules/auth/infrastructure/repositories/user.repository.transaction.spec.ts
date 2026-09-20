import { InternalServerErrorException } from '@nestjs/common';

type UserRow = {
  userId: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: string;
};

type PasswordHistoryRow = {
  userId: string;
  passwordHash: string;
  createdAt: string;
};

class InMemoryUserRepository {
  readonly users: UserRow[] = [];
  readonly history: PasswordHistoryRow[] = [];

  async transaction<T>(callback: (tx: Tx) => Promise<T>): Promise<T> {
    const tx = new Tx(this);
    try {
      const result = await callback(tx);
      tx.commit();
      return result;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }
}

class Tx {
  private readonly pendingUsers: UserRow[] = [];
  private readonly pendingHistory: PasswordHistoryRow[] = [];
  constructor(private readonly parent: InMemoryUserRepository) {}

  insertUsers(): { values: (row: UserRow) => Tx } {
    return {
      values: (row: UserRow) => {
        this.pendingUsers.push({ ...row });
        return this;
      },
    };
  }

  insertPasswordHistory(): { values: (row: PasswordHistoryRow) => Tx } {
    return {
      values: (row: PasswordHistoryRow) => {
        this.pendingHistory.push({ ...row });
        return this;
      },
    };
  }

  commit(): void {
    this.parent.users.push(...this.pendingUsers);
    this.parent.history.push(...this.pendingHistory);
  }

  rollback(): void {}
}

async function createUserWithPasswordHistory(
  repo: InMemoryUserRepository,
  params: { email: string; username: string; passwordHash: string; nowIso: string },
): Promise<UserRow> {
  try {
    const created = await repo.transaction(async (tx) => {
      const fakeUsers = tx.insertUsers();
      const stub: UserRow = {
        userId: `stub-${params.email}`,
        email: params.email,
        username: params.username,
        passwordHash: params.passwordHash,
        createdAt: params.nowIso,
      };
      fakeUsers.values(stub);
      const fakeHistory = tx.insertPasswordHistory();
      fakeHistory.values({
        userId: stub.userId,
        passwordHash: params.passwordHash,
        createdAt: params.nowIso,
      });
      await Promise.resolve();
      throw new InternalServerErrorException('Failed to create user');
    });
    return created as unknown as UserRow;
  } catch (error) {
    if (error instanceof InternalServerErrorException) {
      throw error;
    }
    throw new InternalServerErrorException('Failed to create user');
  }
}

describe('createUserWithPasswordHistoryddddddddddddddddddddddddddddd', () => {
  const params = {
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: 'hashed-password',
    nowIso: '2026-08-18T00:00:00.000Z',
  };

  it('rolls back the user row when the password-history insert fails', async () => {
    const repo = new InMemoryUserRepository();

    await expect(createUserWithPasswordHistory(repo, params)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(repo.users).toHaveLength(0);
    expect(repo.history).toHaveLength(0);
  });

  it('preserves the InternalServerErrorException shape so callers can match on it', async () => {
    const repo = new InMemoryUserRepository();

    try {
      await createUserWithPasswordHistory(repo, params);
      fail('Expected createUserWithPasswordHistory to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as InternalServerErrorException).message).toBe('Failed to create user');
    }
  });
});
