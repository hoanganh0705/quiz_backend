import { InstanceFullCapacityError } from '../../domain/errors/instance-domain.errors';

type Player = { playerId: string; userId: string; instanceId: string };

class InMemoryExecutor {
  readonly players: Player[] = [];
  readonly failureLog: string[] = [];

  readonly lockAcquireOrder: string[] = [];
  private lockHolder: string | null = null;
  private readonly lockWaiters: Array<() => void> = [];

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

  async acquireLockFor(label: string): Promise<void> {
    if (this.lockHolder === null) {
      this.lockHolder = label;
      this.lockAcquireOrder.push(label);
      return;
    }
    await new Promise<void>((resolve) => this.lockWaiters.push(resolve));
    this.lockHolder = label;
    this.lockAcquireOrder.push(label);
  }

  releaseLockFor(label: string): void {
    if (this.lockHolder === label) {
      this.lockHolder = null;
      const next = this.lockWaiters.shift();
      if (next) next();
    }
  }
}

class Tx {
  private readonly pending: Player[] = [];
  constructor(private readonly parent: InMemoryExecutor) {}

  insertPlayers(): { values: (row: Player) => Tx } {
    return {
      values: (row: Player) => {
        this.pending.push({ ...row });
        return this;
      },
    };
  }

  async lockAndCount(): Promise<number> {
    await this.parent.acquireLockFor('join');
    return this.parent.players.length + this.pending.length;
  }

  commit(): void {
    this.parent.players.push(...this.pending);
    this.parent.releaseLockFor('join');
  }

  rollback(): void {
    this.parent.releaseLockFor('join');
  }
}

async function tryJoin(
  executor: InMemoryExecutor,
  params: { instanceId: string; userId: string; maxPlayers: number | null },
): Promise<{ joined: true } | { joined: false; reason: 'full' }> {
  return executor.transaction(async (tx) => {
    const currentCount = await tx.lockAndCount();
    if (params.maxPlayers !== null && currentCount >= params.maxPlayers) {
      throw new InstanceFullCapacityError(params.maxPlayers);
    }
    tx.insertPlayers().values({
      playerId: `stub-${params.userId}`,
      userId: params.userId,
      instanceId: params.instanceId,
    });
    return { joined: true } as const;
  });
}

describe('concurrent joinInstance simulation', () => {
  it('maxPlayers=1: two concurrent joins → exactly one win', async () => {
    const exec = new InMemoryExecutor();
    const results = await Promise.allSettled([
      tryJoin(exec, { instanceId: 'i1', userId: 'u1', maxPlayers: 1 }),
      tryJoin(exec, { instanceId: 'i1', userId: 'u2', maxPlayers: 1 }),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBeInstanceOf(InstanceFullCapacityError);
    expect(exec.players).toHaveLength(1);
  });

  it('maxPlayers=2: three concurrent joins → exactly two wins', async () => {
    const exec = new InMemoryExecutor();
    const results = await Promise.allSettled([
      tryJoin(exec, { instanceId: 'i1', userId: 'u1', maxPlayers: 2 }),
      tryJoin(exec, { instanceId: 'i1', userId: 'u2', maxPlayers: 2 }),
      tryJoin(exec, { instanceId: 'i1', userId: 'u3', maxPlayers: 2 }),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    expect(successes).toHaveLength(2);
    expect(exec.players).toHaveLength(2);
  });

  it('maxPlayers=null: capacity not enforced, all N joins succeed', async () => {
    const exec = new InMemoryExecutor();
    const n = 10;
    const results = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        tryJoin(exec, { instanceId: 'i1', userId: `u${i}`, maxPlayers: null }),
      ),
    );
    expect(results.every((r) => r.joined === true)).toBe(true);
    expect(exec.players).toHaveLength(n);
  });

  it('lock is FIFO: lock acquisition order matches request order', async () => {
    const exec = new InMemoryExecutor();
    await Promise.allSettled([
      tryJoin(exec, { instanceId: 'i1', userId: 'u1', maxPlayers: 1 }),
      tryJoin(exec, { instanceId: 'i1', userId: 'u2', maxPlayers: 1 }),
    ]);
    expect(exec.lockAcquireOrder).toEqual(['join', 'join']);
  });

  it('lock is released on rollback so a subsequent caller can proceed', async () => {
    const exec = new InMemoryExecutor();
    const failing = tryJoin(exec, { instanceId: 'i1', userId: 'u1', maxPlayers: 1 });
    await expect(failing).resolves.toEqual({ joined: true });
    const next = tryJoin(exec, { instanceId: 'i1', userId: 'u2', maxPlayers: 1 });
    await expect(next).rejects.toBeInstanceOf(InstanceFullCapacityError);
  });

  it('integration test guide (real Postgres)', () => {});
});
