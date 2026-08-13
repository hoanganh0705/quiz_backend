/**
 * Unit tests for `createCommentSnapshot`.
 *
 * The snapshot mapper is the source of truth that every realtime event
 * (`comment_created`, `comment_edited`, `comment_hidden`,
 * `comment_restored`) emits so the frontend can apply the event
 * directly without a refetch. These tests pin the snapshot shape and
 * the optional-absence rules so any future drift fails CI.
 */
import {
  CommentSnapshot,
  createCommentSnapshot,
} from '@/modules/comment/domain/events/comment.events';
import type { CommentView } from '@/modules/comment/domain/types';

function makeCommentView(overrides: Partial<CommentView> = {}): CommentView {
  return {
    id: 'comment-1',
    quizId: 'quiz-1',
    authorId: 'user-1',
    parentCommentId: null,
    body: 'Hello world',
    isHidden: false,
    hiddenById: null,
    hiddenAt: null,
    votesCount: 5,
    upvotesCount: 6,
    downvotesCount: 1,
    repliesCount: 0,
    createdAt: '2026-08-11T10:00:00.000Z',
    updatedAt: '2026-08-11T10:00:00.000Z',
    deletedAt: null,
    author: {
      userId: 'user-1',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: 'https://cdn.example.com/avatars/alice.png',
    },
    ...overrides,
  };
}

describe('createCommentSnapshot', () => {
  it('flattens the nested author object onto the snapshot', () => {
    const view = makeCommentView();
    const snapshot = createCommentSnapshot(view);

    expect(snapshot).toMatchObject({
      id: view.id,
      quizId: view.quizId,
      parentCommentId: view.parentCommentId,
      authorId: view.author.userId,
      authorUsername: view.author.username,
      authorDisplayName: view.author.displayName,
      authorAvatarUrl: view.author.avatarUrl,
      body: view.body,
      isHidden: view.isHidden,
      votesCount: view.votesCount,
      upvotesCount: view.upvotesCount,
      downvotesCount: view.downvotesCount,
      repliesCount: view.repliesCount,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
      deletedAt: view.deletedAt,
    });
  });

  it('marks `isReply: false` for top-level comments', () => {
    const snapshot = createCommentSnapshot(makeCommentView({ parentCommentId: null }));
    expect(snapshot.isReply).toBe(false);
  });

  it('marks `isReply: true` when parentCommentId is set', () => {
    const snapshot = createCommentSnapshot(makeCommentView({ parentCommentId: 'parent-1' }));
    expect(snapshot.isReply).toBe(true);
    expect(snapshot.parentCommentId).toBe('parent-1');
  });

  it('defaults `userVote` to null when not supplied', () => {
    const snapshot = createCommentSnapshot(makeCommentView());
    expect(snapshot.userVote).toBeNull();
  });

  it('forwards the supplied `userVote` value', () => {
    expect(createCommentSnapshot(makeCommentView(), 'upvote').userVote).toBe('upvote');
    expect(createCommentSnapshot(makeCommentView(), 'downvote').userVote).toBe('downvote');
    expect(createCommentSnapshot(makeCommentView(), null).userVote).toBeNull();
  });

  it('passes through `null` for optional author fields when the author has none', () => {
    const view = makeCommentView({
      author: {
        userId: 'user-2',
        username: 'bob',
        displayName: null,
        avatarUrl: null,
      },
    });
    const snapshot = createCommentSnapshot(view);

    expect(snapshot.authorDisplayName).toBeNull();
    expect(snapshot.authorAvatarUrl).toBeNull();
    expect(snapshot.authorUsername).toBe('bob');
    expect(snapshot.authorId).toBe('user-2');
  });

  it('passes through `deletedAt: null` for live comments', () => {
    const snapshot = createCommentSnapshot(makeCommentView({ deletedAt: null }));
    expect(snapshot.deletedAt).toBeNull();
  });

  it('passes through a non-null `deletedAt` for tombstoned comments', () => {
    const tombstonedAt = '2026-08-11T11:30:00.000Z';
    const snapshot = createCommentSnapshot(makeCommentView({ deletedAt: tombstonedAt }));
    expect(snapshot.deletedAt).toBe(tombstonedAt);
  });

  it('mirrors `isHidden: true` for hidden comments', () => {
    const snapshot = createCommentSnapshot(makeCommentView({ isHidden: true }));
    expect(snapshot.isHidden).toBe(true);
  });

  it('produces an object that satisfies the CommentSnapshot interface', () => {
    const snapshot: CommentSnapshot = createCommentSnapshot(makeCommentView());
    // If the shape changes, the structural assignment above will fail
    // at compile time; runtime we just sanity-check the field set.
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'authorAvatarUrl',
        'authorDisplayName',
        'authorId',
        'authorUsername',
        'body',
        'createdAt',
        'deletedAt',
        'downvotesCount',
        'id',
        'isHidden',
        'isReply',
        'parentCommentId',
        'quizId',
        'repliesCount',
        'updatedAt',
        'upvotesCount',
        'userVote',
        'votesCount',
      ].sort(),
    );
  });

  it('does not leak the nested `author` field onto the snapshot', () => {
    const snapshot = createCommentSnapshot(makeCommentView());
    expect((snapshot as unknown as { author?: unknown }).author).toBeUndefined();
  });
});
