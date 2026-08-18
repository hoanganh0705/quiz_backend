/**
 * Unit tests for `UserResponseMapper` URL derivation.
 *
 * Coverage:
 *   - `avatarPublicId` takes precedence over `avatarUrl` when set.
 *   - Falls back to legacy `avatarUrl` when `avatarPublicId` is null.
 *   - The public `resolveAvatarUrl` helper exposes the same logic.
 */

import { UserResponseMapper } from './user-response.mapper';
import type { StoragePort } from '@/core/storage/storage.port';
import type { UserMeRow, UserLookupRow } from '../domain/ports/user-repository.port';

class FakeStorage implements StoragePort {
  readonly calls: Array<{ publicId: string; purpose: 'avatar' | 'quiz' }> = [];

  upload(): Promise<never> {
    throw new Error('not used');
  }
  delete(): Promise<void> {
    return Promise.resolve();
  }
  deriveUrl(publicId: string, purpose: 'avatar' | 'quiz'): string {
    this.calls.push({ publicId, purpose });
    return `https://cdn.test/${purpose}/${publicId}`;
  }
}

function makeMeRow(overrides: Partial<UserMeRow> = {}): UserMeRow {
  return {
    userId: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: 'https://legacy.test/avatar.png',
    avatarPublicId: null,
    bio: null,
    xpTotal: 0,
    settings: {},
    currentStreak: 0,
    longestStreak: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeLookupRow(overrides: Partial<UserLookupRow> = {}): UserLookupRow {
  return {
    userId: 'u1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: 'https://legacy.test/avatar.png',
    avatarPublicId: null,
    isVerified: false,
    ...overrides,
  };
}

describe('UserResponseMapper — URL derivation', () => {
  it('prefers avatarPublicId (Cloudinary) when set', () => {
    const storage = new FakeStorage();
    const mapper = new UserResponseMapper(storage);
    const row = makeMeRow({
      avatarPublicId: 'quiz-app/avatars/u1/abc',
      avatarUrl: 'https://legacy.test/avatar.png',
    });

    const result = mapper.toUserMeResponse(row);

    expect(result.avatarUrl).toBe('https://cdn.test/avatar/quiz-app/avatars/u1/abc');
    expect(storage.calls).toEqual([{ publicId: 'quiz-app/avatars/u1/abc', purpose: 'avatar' }]);
  });

  it('falls back to legacy avatarUrl when avatarPublicId is null', () => {
    const storage = new FakeStorage();
    const mapper = new UserResponseMapper(storage);
    const row = makeMeRow({ avatarPublicId: null, avatarUrl: 'https://legacy.test/avatar.png' });

    const result = mapper.toUserMeResponse(row);

    expect(result.avatarUrl).toBe('https://legacy.test/avatar.png');
    expect(storage.calls).toHaveLength(0);
  });

  it('returns null when both are null', () => {
    const storage = new FakeStorage();
    const mapper = new UserResponseMapper(storage);
    const row = makeMeRow({ avatarPublicId: null, avatarUrl: null });

    const result = mapper.toUserMeResponse(row);

    expect(result.avatarUrl).toBeNull();
  });

  it('lookup response also prefers avatarPublicId', () => {
    const storage = new FakeStorage();
    const mapper = new UserResponseMapper(storage);
    const row = makeLookupRow({
      avatarPublicId: 'quiz-app/avatars/u1/xyz',
      avatarUrl: 'https://legacy.test/avatar.png',
    });

    const result = mapper.toUserLookupResponse(row);

    expect(result.avatarUrl).toBe('https://cdn.test/avatar/quiz-app/avatars/u1/xyz');
  });

  it('resolveAvatarUrl helper exposes the same logic', () => {
    const storage = new FakeStorage();
    const mapper = new UserResponseMapper(storage);

    expect(
      mapper.resolveAvatarUrl('quiz-app/avatars/u1/abc', 'https://legacy.test/avatar.png'),
    ).toBe('https://cdn.test/avatar/quiz-app/avatars/u1/abc');
    expect(mapper.resolveAvatarUrl(null, 'https://legacy.test/avatar.png')).toBe(
      'https://legacy.test/avatar.png',
    );
    expect(mapper.resolveAvatarUrl(null, null)).toBeNull();
  });
});
