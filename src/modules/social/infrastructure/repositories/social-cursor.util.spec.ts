import { sliceWithCursor, encodeFollowCursor, encodeUsernameCursor } from './social-cursor.util';

describe('sliceWithCursor', () => {
  it('returns the first `limit` rows and no next cursor when there is no overflow', () => {
    const result = sliceWithCursor([1, 2, 3], 5, (last) => `c:${last}`);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.hasNextPage).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('returns the first `limit` rows and encodes a next cursor when overflow present', () => {
    const result = sliceWithCursor([1, 2, 3, 4, 5], 3, (last) => `c:${last}`);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBe('c:3');
  });

  it('emits null cursor when the page is exactly the limit and no overflow', () => {
    const result = sliceWithCursor([1, 2, 3], 3, (last) => `c:${last}`);
    expect(result.hasNextPage).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});

describe('encodeFollowCursor', () => {
  it('emits base64url JSON with the expected payload', () => {
    const cursor = encodeFollowCursor({ followedAt: '2026-01-01T00:00:00.000Z', followId: 'f1' });
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    expect(decoded).toEqual({ followedAt: '2026-01-01T00:00:00.000Z', followId: 'f1' });
  });
});

describe('encodeUsernameCursor', () => {
  it('emits base64url JSON with the expected payload', () => {
    const cursor = encodeUsernameCursor({ username: 'alice' });
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    expect(decoded).toEqual({ username: 'alice' });
  });
});
