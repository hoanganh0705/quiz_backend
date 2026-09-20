import { BadRequestException } from '@nestjs/common';
import { FriendshipRepository } from './friendship.repository';

describe('FriendshipRepository.removeFriendInTx', () => {
  it('returns the row count from the tx UPDATE', async () => {
    const tx = {
      execute: jest.fn().mockResolvedValue({ rows: [{ friendshipId: 'f-1' }] }),
    };
    const repo = new FriendshipRepository({} as never);
    const result = await repo.removeFriendInTx(tx as never, 'user-1', 'user-2');
    expect(result).toBe(1);
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no matching row exists', async () => {
    const tx = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
    const repo = new FriendshipRepository({} as never);
    const result = await repo.removeFriendInTx(tx as never, 'user-1', 'user-2');
    expect(result).toBe(0);
  });

  it('rejects a malformed base64url cursor via getMutualFriends', async () => {
    const db = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const repo = new FriendshipRepository(db as never);
    await expect(
      repo.getMutualFriends('user-1', 'user-2', 'not-base64!', 20),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
