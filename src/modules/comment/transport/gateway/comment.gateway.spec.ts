/**
 * Comment Gateway — `serializeEvent` wire-payload tests.
 *
 * The CommentGateway is a thin layer over socket.io that:
 *   1. Subscribes to the domain event bus.
 *   2. Serialises each event into a JSON-safe wire payload via the
 *      private `serializeEvent` helper.
 *   3. Emits the payload on the appropriate room
 *      (`quiz:{quizId}` or `user:{userId}`).
 *
 * The realtime contract on the frontend depends on the wire payload
 * carrying the same fields that the in-process domain event has —
 * in particular the new `snapshot`, `parentCommentId`, and the vote
 * counters. These tests pin that contract by driving the gateway's
 * public `pushToQuiz` / `pushToUser` entry points (which internally
 * call `serializeEvent`) and asserting on what was emitted.
 */
import { CommentGateway } from '@/modules/comment/transport/gateway/comment.gateway';
import type {
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentEditedEvent,
  CommentHiddenEvent,
  CommentMentionedEvent,
  CommentRestoredEvent,
  CommentSnapshot,
  ReportReviewedEvent,
  VoteCastEvent,
  VoteRemovedEvent,
} from '@/modules/comment/domain/events';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as const;

function makeGateway(): {
  gateway: CommentGateway;
  emit: jest.Mock;
  toRoom: jest.Mock;
} {
  const toRoom = jest.fn().mockReturnValue({ emit: jest.fn() });
  const emit = jest.fn();
  const fakeServer = {
    to: toRoom,
    emit,
    in: jest.fn().mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([]),
    }),
  };
  const gateway = new CommentGateway(logger as never);
  // Inject the fake socket.io server. The property is non-null at
  // runtime thanks to @WebSocketServer(), so we bypass readonly.
  (gateway as unknown as { server: typeof fakeServer }).server = fakeServer;
  return { gateway, emit, toRoom };
}

interface CapturedEmit {
  channel: string;
  payload: Record<string, unknown>;
}

interface MockedRoom {
  emit: jest.Mock;
}

type EmitCall = readonly [string, Record<string, unknown>];

function captureEmit(toRoom: jest.Mock): CapturedEmit {
  const result = toRoom.mock.results[0];
  if (result === undefined) {
    throw new Error('Expected toRoom to have been called');
  }
  const target = result.value as MockedRoom;
  const calls = target.emit.mock.calls as readonly EmitCall[];
  const call = calls[0];
  if (call === undefined) {
    throw new Error('Expected emit to have been called');
  }
  const [channel, payload] = call;
  return { channel, payload };
}

const snapshot: CommentSnapshot = {
  id: 'comment-1',
  quizId: 'quiz-1',
  parentCommentId: null,
  authorId: 'author-1',
  authorUsername: 'alice',
  authorDisplayName: 'Alice',
  authorAvatarUrl: 'https://cdn.example.com/avatars/alice.png',
  body: 'Hello',
  isHidden: false,
  votesCount: 5,
  upvotesCount: 6,
  downvotesCount: 1,
  repliesCount: 0,
  userVote: null,
  createdAt: '2026-08-11T10:00:00.000Z',
  updatedAt: '2026-08-11T10:00:00.000Z',
  deletedAt: null,
  isReply: false,
};

describe('CommentGateway.serializeEvent (via pushToQuiz/pushToUser)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serialises comment_created with snapshot into the wire payload', () => {
    const { gateway, toRoom } = makeGateway();

    const event: CommentCreatedEvent = {
      eventType: 'comment_created',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      parentCommentId: null,
      authorId: 'author-1',
      authorUsername: 'alice',
      parentCommentAuthorId: null,
      isReply: false,
      timestamp: new Date('2026-08-11T10:00:00.000Z'),
      snapshot,
    };

    gateway.pushToQuiz(event);

    expect(toRoom).toHaveBeenCalledWith('quiz:quiz-1');
    const { channel, payload } = captureEmit(toRoom);
    expect(channel).toBe('comment');

    expect(payload).toMatchObject({
      eventType: 'comment_created',
      timestamp: '2026-08-11T10:00:00.000Z',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      parentCommentId: null,
      authorId: 'author-1',
      authorUsername: 'alice',
      isReply: false,
    });
    // Snapshot is mirrored verbatim — no field is dropped or renamed.
    expect(payload.snapshot).toEqual(snapshot);
  });

  it('serialises comment_edited with snapshot into the wire payload', () => {
    const { gateway, toRoom } = makeGateway();

    const event: CommentEditedEvent = {
      eventType: 'comment_edited',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      authorId: 'author-1',
      timestamp: new Date('2026-08-11T11:00:00.000Z'),
      snapshot: { ...snapshot, body: 'updated' },
    };

    gateway.pushToQuiz(event);

    const { payload } = captureEmit(toRoom);
    expect(payload).toMatchObject({
      eventType: 'comment_edited',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      authorId: 'author-1',
    });
    expect((payload.snapshot as CommentSnapshot).body).toBe('updated');
  });

  it('serialises comment_deleted with parentCommentId into the wire payload', () => {
    const { gateway, toRoom } = makeGateway();

    const event: CommentDeletedEvent = {
      eventType: 'comment_deleted',
      commentId: 'reply-1',
      quizId: 'quiz-1',
      authorId: 'author-1',
      timestamp: new Date('2026-08-11T12:00:00.000Z'),
      parentCommentId: 'parent-1',
    };

    gateway.pushToQuiz(event);

    const { payload } = captureEmit(toRoom);
    expect(payload).toEqual({
      eventType: 'comment_deleted',
      timestamp: '2026-08-11T12:00:00.000Z',
      commentId: 'reply-1',
      quizId: 'quiz-1',
      authorId: 'author-1',
      parentCommentId: 'parent-1',
    });
  });

  it('serialises comment_hidden with snapshot into the wire payload', () => {
    const { gateway, toRoom } = makeGateway();

    const event: CommentHiddenEvent = {
      eventType: 'comment_hidden',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      moderatorId: 'mod-1',
      timestamp: new Date('2026-08-11T13:00:00.000Z'),
      snapshot: { ...snapshot, isHidden: true },
    };

    gateway.pushToQuiz(event);

    const { payload } = captureEmit(toRoom);
    expect(payload).toMatchObject({
      eventType: 'comment_hidden',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      moderatorId: 'mod-1',
    });
    const hiddenSnapshot = payload.snapshot as CommentSnapshot;
    expect(hiddenSnapshot.isHidden).toBe(true);
    expect(hiddenSnapshot.id).toBe('comment-1');
  });

  it('serialises comment_restored with snapshot into the wire payload', () => {
    const { gateway, toRoom } = makeGateway();

    const event: CommentRestoredEvent = {
      eventType: 'comment_restored',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      moderatorId: 'mod-1',
      timestamp: new Date('2026-08-11T14:00:00.000Z'),
      snapshot: { ...snapshot, isHidden: false },
    };

    gateway.pushToQuiz(event);

    const { payload } = captureEmit(toRoom);
    expect(payload).toMatchObject({
      eventType: 'comment_restored',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      moderatorId: 'mod-1',
    });
    const restoredSnapshot = payload.snapshot as CommentSnapshot;
    expect(restoredSnapshot.isHidden).toBe(false);
  });

  it('serialises vote_cast with vote counters into the wire payload', () => {
    const { gateway, toRoom } = makeGateway();

    const event: VoteCastEvent = {
      eventType: 'vote_cast',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      voterId: 'voter-1',
      value: 'upvote',
      timestamp: new Date('2026-08-11T15:00:00.000Z'),
      votesCount: 5,
      upvotesCount: 6,
      downvotesCount: 1,
    };

    gateway.pushToQuiz(event);

    const { payload } = captureEmit(toRoom);
    expect(payload).toEqual({
      eventType: 'vote_cast',
      timestamp: '2026-08-11T15:00:00.000Z',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      voterId: 'voter-1',
      value: 'upvote',
      votesCount: 5,
      upvotesCount: 6,
      downvotesCount: 1,
    });
  });

  it('serialises vote_removed with vote counters into the wire payload', () => {
    const { gateway, toRoom } = makeGateway();

    const event: VoteRemovedEvent = {
      eventType: 'vote_removed',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      voterId: 'voter-1',
      timestamp: new Date('2026-08-11T16:00:00.000Z'),
      votesCount: 4,
      upvotesCount: 4,
      downvotesCount: 0,
    };

    gateway.pushToQuiz(event);

    const { payload } = captureEmit(toRoom);
    expect(payload).toEqual({
      eventType: 'vote_removed',
      timestamp: '2026-08-11T16:00:00.000Z',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      voterId: 'voter-1',
      votesCount: 4,
      upvotesCount: 4,
      downvotesCount: 0,
    });
  });

  it('pushes personal events to the user room via pushToUser', () => {
    const { gateway, toRoom } = makeGateway();

    const event: CommentMentionedEvent = {
      eventType: 'comment_mentioned',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      mentionedUserId: 'user-42',
      mentionedUsername: 'bob',
      authorId: 'author-1',
      authorUsername: 'alice',
      timestamp: new Date('2026-08-11T17:00:00.000Z'),
    };

    gateway.pushToUser('user-42', event);

    expect(toRoom).toHaveBeenCalledWith('user:user-42');
    const { channel, payload } = captureEmit(toRoom);
    expect(channel).toBe('comment');
    expect(payload).toMatchObject({
      eventType: 'comment_mentioned',
      timestamp: '2026-08-11T17:00:00.000Z',
    });
  });

  it('serialises Date timestamps to ISO strings for JSON safety', () => {
    const { gateway, toRoom } = makeGateway();

    const event: CommentEditedEvent = {
      eventType: 'comment_edited',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      authorId: 'author-1',
      timestamp: new Date('2026-08-11T18:30:45.123Z'),
      snapshot,
    };

    gateway.pushToQuiz(event);

    const { payload } = captureEmit(toRoom);
    expect(typeof payload.timestamp).toBe('string');
    expect(payload.timestamp).toBe('2026-08-11T18:30:45.123Z');
  });

  it('does not emit to a quiz room when the event lacks a quizId', () => {
    const { gateway, toRoom } = makeGateway();

    const event: ReportReviewedEvent = {
      eventType: 'report_reviewed',
      reportId: 'report-1',
      reviewerId: 'mod-1',
      status: 'reviewed',
      actionTaken: false,
      timestamp: new Date(),
    };

    gateway.pushToQuiz(event);

    expect(toRoom).not.toHaveBeenCalled();
  });
});
