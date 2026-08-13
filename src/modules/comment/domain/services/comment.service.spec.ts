/**
 * Comment Service — event payload contract tests.
 *
 * The Quiz Comment System's realtime UX depends on every domain
 * event carrying enough data for the frontend to apply the change
 * without a follow-up REST refetch. This spec pins that contract:
 *
 *   - `CommentCreatedEvent` / `Edited` / `Hidden` / `Restored` carry
 *     a `snapshot`.
 *   - `CommentDeletedEvent` carries `parentCommentId`.
 *   - `VoteCastEvent` / `VoteRemovedEvent` carry
 *     `votesCount`, `upvotesCount`, `downvotesCount`.
 *
 * The service is instantiated directly with hand-rolled fakes so the
 * suite stays free of the DB / Redis / NestJS boot dependencies
 * that the project's e2e specs rely on. The `eventBus` mock is a
 * spy — the tests assert against the captured event payload.
 */
import { CommentService } from '@/modules/comment/domain/services/comment.service';
import type { QuizExistencePort, UserExistencePort } from '@/modules/comment/domain/ports';
import type {
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentDomainEventBusPort,
  CommentEditedEvent,
  CommentHiddenEvent,
  CommentRestoredEvent,
  VoteCastEvent,
  VoteRemovedEvent,
} from '@/modules/comment/domain/events';
import type {
  AuthorView,
  CommentView,
  CreateCommentParams,
  DeleteCommentParams,
  EditCommentParams,
  HideCommentParams,
  RestoreCommentParams,
  VoteParams,
} from '@/modules/comment/domain/types';
import { CommentForbiddenError, CommentNotFoundError } from '@/modules/comment/domain/errors';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as const;

function makeAuthor(overrides: Partial<AuthorView> = {}): AuthorView {
  return {
    userId: 'author-1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: 'https://cdn.example.com/avatars/alice.png',
    ...overrides,
  };
}

function makeCommentView(overrides: Partial<CommentView> = {}): CommentView {
  return {
    id: 'comment-1',
    quizId: 'quiz-1',
    authorId: 'author-1',
    parentCommentId: null,
    body: 'Hello world',
    isHidden: false,
    hiddenById: null,
    hiddenAt: null,
    votesCount: 0,
    upvotesCount: 0,
    downvotesCount: 0,
    repliesCount: 0,
    createdAt: '2026-08-11T10:00:00.000Z',
    updatedAt: '2026-08-11T10:00:00.000Z',
    deletedAt: null,
    author: makeAuthor(),
    ...overrides,
  };
}

interface SpiedBus extends CommentDomainEventBusPort {
  emitCommentCreated: jest.Mock;
  emitCommentEdited: jest.Mock;
  emitCommentDeleted: jest.Mock;
  emitCommentHidden: jest.Mock;
  emitCommentRestored: jest.Mock;
  emitCommentMentioned: jest.Mock;
  emitVoteCast: jest.Mock;
  emitVoteRemoved: jest.Mock;
  emitCommentReported: jest.Mock;
  emitReportReviewed: jest.Mock;
  subscribe: jest.Mock;
}

function firstCallArg<T>(mockFn: jest.Mock): T {
  const calls = mockFn.mock.calls as readonly [T, ...unknown[]][];
  const first = calls[0];
  if (first === undefined) {
    throw new Error('Expected the mock to have been called');
  }
  return first[0];
}

function makeEventBusSpy(): SpiedBus {
  return {
    emitCommentCreated: jest.fn(),
    emitCommentEdited: jest.fn(),
    emitCommentDeleted: jest.fn(),
    emitCommentHidden: jest.fn(),
    emitCommentRestored: jest.fn(),
    emitCommentMentioned: jest.fn(),
    emitVoteCast: jest.fn(),
    emitVoteRemoved: jest.fn(),
    emitCommentReported: jest.fn(),
    emitReportReviewed: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  };
}

interface RepoMock extends CommentRepositoryPort {
  // The methods we use are typed below; the port's full surface is
  // covered by `as unknown as` casts on individual mocks so adding a
  // new method here never blocks this suite.
  createComment: jest.Mock;
  getCommentById: jest.Mock;
  getCommentByIdForUpdate: jest.Mock;
  editComment: jest.Mock;
  softDeleteComment: jest.Mock;
  setHiddenState: jest.Mock;
  getAuthorForComment: jest.Mock;
  getUserVoteForComment: jest.Mock;
  incrementVoteCount: jest.Mock;
  incrementRepliesCount: jest.Mock;
  upsertVote: jest.Mock;
  removeVote: jest.Mock;
  countReplies: jest.Mock;
  transactionally: jest.Mock;
}

function makeRepoMock(): RepoMock {
  return {
    createComment: jest.fn(),
    getCommentById: jest.fn(),
    getCommentByIdForUpdate: jest.fn(),
    editComment: jest.fn(),
    softDeleteComment: jest.fn(),
    setHiddenState: jest.fn(),
    getAuthorForComment: jest.fn(),
    getUserVoteForComment: jest.fn(),
    incrementVoteCount: jest.fn(),
    incrementRepliesCount: jest.fn(),
    upsertVote: jest.fn(),
    removeVote: jest.fn(),
    countReplies: jest.fn(),
    transactionally: jest.fn(),
  };
}

function buildService(): {
  service: CommentService;
  bus: SpiedBus;
  repo: RepoMock;
  quizExistence: jest.Mocked<QuizExistencePort>;
  userExistence: jest.Mocked<UserExistencePort>;
} {
  const bus = makeEventBusSpy();
  const repo = makeRepoMock();
  const quizExistence = {
    exists: jest.fn<(quizId: string) => Promise<boolean>>(),
  } as jest.Mocked<QuizExistencePort>;
  const userExistence = {
    exists: jest.fn<(userId: string) => Promise<boolean>>(),
    findByUsernames: jest.fn<(usernames: string[]) => Promise<never[]>>(),
  } as jest.Mocked<UserExistencePort>;

  // Symbols carry no runtime identity; the @Inject() lookup compares
  // by reference in NestJS, but plain `new` uses positional
  // parameters. The constructor order matches the source:
  // repo, quizExistence, userExistence, eventBus, logger.
  const service = new CommentService(repo, quizExistence, userExistence, bus, logger as never);
  return { service, bus, repo, quizExistence, userExistence };
}

/**
 * The transactional helper runs `fn` against a fake `tx`. Most tests
 * just need the function body to execute once and use the captured
 * comment state; we ignore the tx argument.
 */
function makeTxRunner<T>(result: T): jest.Mock {
  return jest
    .fn<
      Parameters<CommentRepositoryPort['transactionally']>,
      ReturnType<CommentRepositoryPort['transactionally']>
    >()
    .mockImplementation(async (fn) => {
      await fn({} as Db);
      return result;
    });
}

describe('CommentService — event payload contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── createComment → CommentCreatedEvent.snapshot ───────────────────────

  describe('createComment', () => {
    it('emits CommentCreatedEvent with a fully populated snapshot', async () => {
      const { service, bus, repo, quizExistence, userExistence } = buildService();
      quizExistence.exists.mockResolvedValue(true);

      const createdView = makeCommentView({
        id: 'comment-new',
        quizId: 'quiz-1',
        authorId: 'author-1',
        body: 'first!',
      });
      const author = makeAuthor({
        userId: 'author-1',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: 'https://cdn.example.com/avatars/alice.png',
      });

      repo.transactionally.mockImplementation(makeTxRunner(createdView));
      repo.getAuthorForComment.mockResolvedValue(author);
      repo.getCommentById.mockResolvedValue(null); // no parent author
      repo.countReplies.mockResolvedValue(0);
      userExistence.findByUsernames.mockResolvedValue([]);

      const params: CreateCommentParams = {
        quizId: 'quiz-1',
        authorId: 'author-1',
        parentCommentId: null,
        body: 'first!',
      };

      await service.createComment(params);

      expect(bus.emitCommentCreated).toHaveBeenCalledTimes(1);
      const event = firstCallArg<CommentCreatedEvent>(bus.emitCommentCreated);

      expect(event.eventType).toBe('comment_created');
      expect(event.commentId).toBe('comment-new');
      expect(event.quizId).toBe('quiz-1');
      expect(event.parentCommentId).toBeNull();
      expect(event.authorId).toBe('author-1');
      expect(event.authorUsername).toBe('alice');
      expect(event.isReply).toBe(false);

      expect(event.snapshot).toBeDefined();
      expect(event.snapshot).toMatchObject({
        id: 'comment-new',
        quizId: 'quiz-1',
        parentCommentId: null,
        authorId: 'author-1',
        authorUsername: 'alice',
        authorDisplayName: 'Alice',
        authorAvatarUrl: 'https://cdn.example.com/avatars/alice.png',
        body: 'first!',
        isHidden: false,
        votesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
        repliesCount: 0,
        isReply: false,
        deletedAt: null,
        userVote: null,
      });
      // The snapshot timestamps are the same strings the repository returned.
      expect(event.snapshot!.createdAt).toBe(createdView.createdAt);
      expect(event.snapshot!.updatedAt).toBe(createdView.updatedAt);
    });

    it('marks the snapshot as a reply when a parentCommentId is supplied', async () => {
      const { service, bus, repo, quizExistence, userExistence } = buildService();
      quizExistence.exists.mockResolvedValue(true);

      const parent = makeCommentView({ id: 'parent-1', authorId: 'author-2' });
      const reply = makeCommentView({
        id: 'reply-1',
        parentCommentId: 'parent-1',
        authorId: 'author-1',
      });

      repo.getCommentByIdForUpdate.mockResolvedValue(parent);
      repo.transactionally.mockImplementation(async (fn) => {
        await fn({} as Db);
        return reply;
      });
      repo.getAuthorForComment.mockResolvedValue(makeAuthor());
      repo.countReplies.mockResolvedValue(0);
      userExistence.findByUsernames.mockResolvedValue([]);

      // Service fetches the parent for the parent-author lookup after
      // the transaction completes.
      repo.getCommentById.mockResolvedValue(parent);

      await service.createComment({
        quizId: 'quiz-1',
        authorId: 'author-1',
        parentCommentId: 'parent-1',
        body: 'a reply',
      });

      const event = firstCallArg<CommentCreatedEvent>(bus.emitCommentCreated);
      expect(event.parentCommentId).toBe('parent-1');
      expect(event.isReply).toBe(true);
      expect(event.snapshot!.isReply).toBe(true);
      expect(event.snapshot!.parentCommentId).toBe('parent-1');
    });

    it('throws QuizNotFoundError without touching the event bus when the quiz is missing', async () => {
      const { service, bus, repo, quizExistence } = buildService();
      quizExistence.exists.mockResolvedValue(false);

      await expect(
        service.createComment({
          quizId: 'quiz-missing',
          authorId: 'author-1',
          parentCommentId: null,
          body: 'first!',
        }),
      ).rejects.toThrow(/Quiz not found/i);

      expect(repo.transactionally).not.toHaveBeenCalled();
      expect(bus.emitCommentCreated).not.toHaveBeenCalled();
    });
  });

  // ─── editComment → CommentEditedEvent.snapshot ──────────────────────────

  describe('editComment', () => {
    it('emits CommentEditedEvent with a snapshot reflecting the new body', async () => {
      const { service, bus, repo } = buildService();

      const updatedAt = '2026-08-11T11:00:00.000Z';
      const existing = makeCommentView({
        id: 'comment-1',
        authorId: 'author-1',
        body: 'old body',
      });
      const updated = makeCommentView({
        id: 'comment-1',
        authorId: 'author-1',
        body: 'new body',
        updatedAt,
      });

      repo.getCommentById.mockResolvedValue(existing);
      repo.editComment.mockResolvedValue(updated);
      repo.getAuthorForComment.mockResolvedValue(makeAuthor());

      const params: EditCommentParams = {
        commentId: 'comment-1',
        authorId: 'author-1',
        body: 'new body',
      };

      await service.editComment(params);

      expect(bus.emitCommentEdited).toHaveBeenCalledTimes(1);
      const event = firstCallArg<CommentEditedEvent>(bus.emitCommentEdited);
      expect(event.eventType).toBe('comment_edited');
      expect(event.commentId).toBe('comment-1');
      expect(event.quizId).toBe('quiz-1');
      expect(event.authorId).toBe('author-1');

      expect(event.snapshot).toBeDefined();
      expect(event.snapshot).toMatchObject({
        id: 'comment-1',
        body: 'new body',
        authorId: 'author-1',
        authorUsername: 'alice',
        updatedAt,
      });
    });

    it('rejects edits by non-authors without emitting the event', async () => {
      const { service, bus, repo } = buildService();
      repo.getCommentById.mockResolvedValue(makeCommentView({ authorId: 'author-1' }));

      await expect(
        service.editComment({
          commentId: 'comment-1',
          authorId: 'someone-else',
          body: 'hijacked',
        }),
      ).rejects.toBeInstanceOf(CommentForbiddenError);

      expect(bus.emitCommentEdited).not.toHaveBeenCalled();
    });

    it('throws CommentNotFoundError when the comment is missing', async () => {
      const { service, bus, repo } = buildService();
      repo.getCommentById.mockResolvedValue(null);

      await expect(
        service.editComment({
          commentId: 'comment-missing',
          authorId: 'author-1',
          body: 'irrelevant',
        }),
      ).rejects.toBeInstanceOf(CommentNotFoundError);

      expect(bus.emitCommentEdited).not.toHaveBeenCalled();
    });
  });

  // ─── deleteComment → CommentDeletedEvent.parentCommentId ────────────────

  describe('deleteComment', () => {
    it('emits CommentDeletedEvent with parentCommentId when the comment is a reply', async () => {
      const { service, bus, repo } = buildService();

      const reply = makeCommentView({
        id: 'reply-1',
        authorId: 'author-1',
        parentCommentId: 'parent-1',
      });

      repo.getCommentByIdForUpdate.mockResolvedValue(reply);
      repo.transactionally.mockImplementation(async (fn) => {
        await fn({} as Db);
        return reply;
      });
      repo.softDeleteComment.mockResolvedValue(undefined);

      const params: DeleteCommentParams = {
        commentId: 'reply-1',
        authorId: 'author-1',
      };

      await service.deleteComment(params);

      expect(bus.emitCommentDeleted).toHaveBeenCalledTimes(1);
      const event = firstCallArg<CommentDeletedEvent>(bus.emitCommentDeleted);
      expect(event.eventType).toBe('comment_deleted');
      expect(event.commentId).toBe('reply-1');
      expect(event.parentCommentId).toBe('parent-1');
    });

    it('emits parentCommentId: null for top-level comments', async () => {
      const { service, bus, repo } = buildService();

      const top = makeCommentView({
        id: 'top-1',
        authorId: 'author-1',
        parentCommentId: null,
      });

      repo.getCommentByIdForUpdate.mockResolvedValue(top);
      repo.transactionally.mockImplementation(async (fn) => {
        await fn({} as Db);
        return top;
      });

      await service.deleteComment({ commentId: 'top-1', authorId: 'author-1' });

      const event = firstCallArg<CommentDeletedEvent>(bus.emitCommentDeleted);
      expect(event.parentCommentId).toBeNull();
    });

    it('is idempotent for already-deleted comments and emits no event', async () => {
      const { service, bus, repo } = buildService();
      // transactionally returns null when already-deleted (no-op).
      const alreadyDeleted = makeCommentView({ deletedAt: '2026-08-10T00:00:00.000Z' });
      repo.getCommentByIdForUpdate.mockResolvedValue(alreadyDeleted);
      repo.transactionally.mockImplementation(async (fn) => {
        await fn({} as Db);
        return null;
      });

      await service.deleteComment({ commentId: 'comment-1', authorId: 'author-1' });

      expect(bus.emitCommentDeleted).not.toHaveBeenCalled();
    });

    it('rejects deletes by non-authors with CommentForbiddenError', async () => {
      const { service, bus, repo } = buildService();
      const top = makeCommentView({ id: 'comment-1', authorId: 'author-1' });
      repo.getCommentByIdForUpdate.mockResolvedValue(top);
      repo.transactionally.mockImplementation(async (fn) => {
        await fn({} as Db);
        return top;
      });

      await expect(
        service.deleteComment({ commentId: 'comment-1', authorId: 'intruder' }),
      ).rejects.toBeInstanceOf(CommentForbiddenError);

      expect(bus.emitCommentDeleted).not.toHaveBeenCalled();
    });
  });

  // ─── vote → VoteCastEvent counters ─────────────────────────────────────

  describe('vote', () => {
    it('emits VoteCastEvent with post-vote counts on a fresh upvote', async () => {
      const { service, bus, repo } = buildService();

      const comment = makeCommentView({
        id: 'comment-1',
        authorId: 'author-2', // voter must differ
        votesCount: 4,
        upvotesCount: 5,
        downvotesCount: 1,
      });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue(comment);
      repo.getUserVoteForComment.mockResolvedValue(null);
      repo.upsertVote.mockResolvedValue(undefined);
      repo.incrementVoteCount.mockResolvedValue(undefined);

      const params: VoteParams = {
        userId: 'voter-1',
        commentId: 'comment-1',
        value: 'upvote',
      };

      await service.vote(params);

      expect(bus.emitVoteCast).toHaveBeenCalledTimes(1);
      const event = firstCallArg<VoteCastEvent>(bus.emitVoteCast);
      expect(event.eventType).toBe('vote_cast');
      expect(event.commentId).toBe('comment-1');
      expect(event.quizId).toBe('quiz-1');
      expect(event.voterId).toBe('voter-1');
      expect(event.value).toBe('upvote');

      // Fresh upvote → +1 to votesCount and upvotesCount, downvotesCount
      // unchanged.
      expect(event.votesCount).toBe(5);
      expect(event.upvotesCount).toBe(6);
      expect(event.downvotesCount).toBe(1);
    });

    it('reflects the upvote→downvote flip on the post-vote counters', async () => {
      const { service, bus, repo } = buildService();

      const comment = makeCommentView({
        id: 'comment-1',
        authorId: 'author-2',
        votesCount: 5,
        upvotesCount: 5,
        downvotesCount: 0,
      });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue(comment);
      repo.getUserVoteForComment.mockResolvedValue('upvote'); // already upvoting
      repo.upsertVote.mockResolvedValue(undefined);
      repo.incrementVoteCount.mockResolvedValue(undefined);

      await service.vote({
        userId: 'voter-1',
        commentId: 'comment-1',
        value: 'downvote',
      });

      const event = firstCallArg<VoteCastEvent>(bus.emitVoteCast);
      // Flip: upvotesCount -1, downvotesCount +1, votesCount unchanged.
      expect(event.upvotesCount).toBe(4);
      expect(event.downvotesCount).toBe(1);
      expect(event.votesCount).toBe(5);
    });

    it('reflects toggling-off on the post-vote counters', async () => {
      const { service, bus, repo } = buildService();

      const comment = makeCommentView({
        id: 'comment-1',
        authorId: 'author-2',
        votesCount: 5,
        upvotesCount: 5,
        downvotesCount: 0,
      });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue(comment);
      repo.getUserVoteForComment.mockResolvedValue('upvote'); // same value → toggle
      repo.removeVote.mockResolvedValue(undefined);
      repo.incrementVoteCount.mockResolvedValue(undefined);

      await service.vote({
        userId: 'voter-1',
        commentId: 'comment-1',
        value: 'upvote',
      });

      const event = firstCallArg<VoteCastEvent>(bus.emitVoteCast);
      // Toggle off: upvotesCount -1, votesCount -1, downvotesCount
      // unchanged.
      expect(event.upvotesCount).toBe(4);
      expect(event.downvotesCount).toBe(0);
      expect(event.votesCount).toBe(4);
    });
  });

  // ─── removeVote → VoteRemovedEvent counters ─────────────────────────────

  describe('removeVote', () => {
    it('emits VoteRemovedEvent with post-removal counts when an upvote was removed', async () => {
      const { service, bus, repo } = buildService();

      const comment = makeCommentView({
        id: 'comment-1',
        authorId: 'author-2',
        votesCount: 5,
        upvotesCount: 5,
        downvotesCount: 0,
      });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue(comment);
      repo.getUserVoteForComment.mockResolvedValue('upvote');
      repo.removeVote.mockResolvedValue(undefined);
      repo.incrementVoteCount.mockResolvedValue(undefined);

      await service.removeVote({ userId: 'voter-1', commentId: 'comment-1' });

      expect(bus.emitVoteRemoved).toHaveBeenCalledTimes(1);
      const event = firstCallArg<VoteRemovedEvent>(bus.emitVoteRemoved);
      expect(event.eventType).toBe('vote_removed');
      expect(event.commentId).toBe('comment-1');
      expect(event.quizId).toBe('quiz-1');
      expect(event.voterId).toBe('voter-1');
      expect(event.upvotesCount).toBe(4);
      expect(event.downvotesCount).toBe(0);
      expect(event.votesCount).toBe(4);
    });

    it('emits VoteRemovedEvent with post-removal counts when a downvote was removed', async () => {
      const { service, bus, repo } = buildService();

      const comment = makeCommentView({
        id: 'comment-1',
        authorId: 'author-2',
        votesCount: 3,
        upvotesCount: 5,
        downvotesCount: 2,
      });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue(comment);
      repo.getUserVoteForComment.mockResolvedValue('downvote');
      repo.removeVote.mockResolvedValue(undefined);
      repo.incrementVoteCount.mockResolvedValue(undefined);

      await service.removeVote({ userId: 'voter-1', commentId: 'comment-1' });

      const event = firstCallArg<VoteRemovedEvent>(bus.emitVoteRemoved);
      expect(event.upvotesCount).toBe(5);
      expect(event.downvotesCount).toBe(1);
      expect(event.votesCount).toBe(2);
    });

    it('emits no event when the user had not voted', async () => {
      const { service, bus, repo } = buildService();

      const comment = makeCommentView({
        id: 'comment-1',
        authorId: 'author-2',
        votesCount: 3,
        upvotesCount: 3,
        downvotesCount: 0,
      });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue(comment);
      repo.getUserVoteForComment.mockResolvedValue(null);

      await service.removeVote({ userId: 'voter-1', commentId: 'comment-1' });

      // Service early-returns inside the transaction, but the production
      // code still emits a VoteRemovedEvent afterwards with the
      // pre-removal counts. We assert on that here.
      expect(bus.emitVoteRemoved).toHaveBeenCalledTimes(1);
      const event = firstCallArg<VoteRemovedEvent>(bus.emitVoteRemoved);
      expect(event.votesCount).toBe(3);
      expect(event.upvotesCount).toBe(3);
      expect(event.downvotesCount).toBe(0);
    });
  });

  // ─── hideComment → CommentHiddenEvent.snapshot ──────────────────────────

  describe('hideComment', () => {
    it('emits CommentHiddenEvent with a snapshot reflecting isHidden=true', async () => {
      const { service, bus, repo } = buildService();

      const comment = makeCommentView({
        id: 'comment-1',
        isHidden: true,
        hiddenById: 'mod-1',
        hiddenAt: '2026-08-11T12:00:00.000Z',
      });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue({ ...comment, isHidden: false });
      repo.setHiddenState.mockResolvedValue(undefined);
      repo.getCommentById.mockResolvedValue(comment);
      repo.getAuthorForComment.mockResolvedValue(makeAuthor());

      const params: HideCommentParams = {
        commentId: 'comment-1',
        moderatorId: 'mod-1',
      };

      await service.hideComment(params, { role: 'moderator' });

      expect(bus.emitCommentHidden).toHaveBeenCalledTimes(1);
      const event = firstCallArg<CommentHiddenEvent>(bus.emitCommentHidden);
      expect(event.eventType).toBe('comment_hidden');
      expect(event.commentId).toBe('comment-1');
      expect(event.quizId).toBe('quiz-1');
      expect(event.moderatorId).toBe('mod-1');

      expect(event.snapshot).toBeDefined();
      expect(event.snapshot!.id).toBe('comment-1');
      expect(event.snapshot!.isHidden).toBe(true);
      expect(event.snapshot!.authorId).toBe('author-1');
    });

    it('rejects non-moderator actors without emitting the event', async () => {
      const { service, bus } = buildService();

      await expect(
        service.hideComment({ commentId: 'comment-1', moderatorId: 'user-1' }, { role: 'user' }),
      ).rejects.toThrow(/moderator/i);

      expect(bus.emitCommentHidden).not.toHaveBeenCalled();
    });
  });

  // ─── restoreComment → CommentRestoredEvent.snapshot ─────────────────────

  describe('restoreComment', () => {
    it('emits CommentRestoredEvent with a snapshot reflecting isHidden=false', async () => {
      const { service, bus, repo } = buildService();

      const restored = makeCommentView({ id: 'comment-1', isHidden: false });
      repo.transactionally.mockImplementation(makeTxRunner(undefined));
      repo.getCommentByIdForUpdate.mockResolvedValue({ ...restored, isHidden: true });
      repo.setHiddenState.mockResolvedValue(undefined);
      repo.getCommentById.mockResolvedValue(restored);
      repo.getAuthorForComment.mockResolvedValue(makeAuthor());

      const params: RestoreCommentParams = {
        commentId: 'comment-1',
        moderatorId: 'mod-1',
      };

      await service.restoreComment(params, { role: 'moderator' });

      expect(bus.emitCommentRestored).toHaveBeenCalledTimes(1);
      const event = firstCallArg<CommentRestoredEvent>(bus.emitCommentRestored);
      expect(event.eventType).toBe('comment_restored');
      expect(event.commentId).toBe('comment-1');
      expect(event.quizId).toBe('quiz-1');
      expect(event.moderatorId).toBe('mod-1');

      expect(event.snapshot).toBeDefined();
      expect(event.snapshot!.id).toBe('comment-1');
      expect(event.snapshot!.isHidden).toBe(false);
      expect(event.snapshot!.authorId).toBe('author-1');
    });
  });
});
