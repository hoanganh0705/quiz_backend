/**
 * CommentService unit tests.
 *
 * Verifies:
 *   - `createComment` enforces the quiz-exists, parent-quiz-match,
 *     two-level rule, parent-accepts-replies, and reply-cap invariants.
 *   - `createComment` and `editComment` emit the right domain events
 *     after the persistent commit succeeds.
 *   - `vote` enforces self-vote forbidden, allows same-value toggle,
 *     and applies the right counter deltas on flip / clear.
 *   - `reportComment` translates a unique-violation into
 *     `DuplicateReportError`.
 *   - `hideComment` / `restoreComment` enforce moderator role via the
 *     authorization policy.
 *
 * The service depends only on ports — the database, the event bus,
 * and the cross-module adapters are all mocked. No Drizzle or Redis
 * is touched in this spec.
 */

import { CommentService } from './comment.service';
import type { CommentRepositoryPort } from '../ports/comment-repository.port';
import type { QuizExistencePort } from '../ports/quiz-existence.port';
import type { UserExistencePort, UserPublicInfo } from '../ports/user-existence.port';
import type { CommentDomainEventBusPort } from '../events';
import type { AuthorView, CommentView, CreateCommentParams, ReportView } from '../types';
import {
  CommentForbiddenError,
  CommentNotFoundError,
  DuplicateReportError,
  ModeratorRequiredError,
  ParentCommentCrossThreadError,
  ReplyLimitExceededError,
  SelfReportError,
  SelfVoteError,
} from '../errors';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import { MAX_REPLIES_PER_COMMENT } from '../constants';

jest.mock('@/common/utils/db-error.util', () => ({
  isPostgresUniqueViolation: jest.fn(),
}));

const mockIsPostgresUniqueViolation = isPostgresUniqueViolation as jest.Mock;

const QUIZ_ID = '11111111-1111-7111-8111-111111111111';
const USER_ID = '22222222-2222-7222-8222-222222222222';
const VOTER_ID = '33333333-3333-7333-8333-333333333333';
const REPORTER_ID = '44444444-4444-7444-8444-444444444444';
const MODERATOR_ID = '55555555-5555-7555-8555-555555555555';
const COMMENT_ID = '66666666-6666-7666-8666-666666666666';
const PARENT_ID = '77777777-7777-7777-8777-777777777777';
const REPORT_ID = '88888888-8888-7888-8888-888888888888';
const NOW = '2026-07-26T00:00:00.000Z';

const mockAuthor: AuthorView = {
  userId: USER_ID,
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
};

const baseComment = {
  id: COMMENT_ID,
  quizId: QUIZ_ID,
  authorId: USER_ID,
  parentCommentId: null,
  body: 'Hello',
  isHidden: false,
  hiddenById: null,
  hiddenAt: null,
  votesCount: 0,
  upvotesCount: 0,
  downvotesCount: 0,
  repliesCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

const mockCommentView: CommentView = { ...baseComment, author: mockAuthor };

const parentCommentView: CommentView = {
  ...mockCommentView,
  id: PARENT_ID,
  parentCommentId: null,
};

const mentionedUser: UserPublicInfo = {
  userId: '99999999-9999-7999-8999-999999999999',
  username: 'bob',
  displayName: 'Bob',
  avatarUrl: null,
};

interface MockRepo extends Pick<
  CommentRepositoryPort,
  | 'getCommentById'
  | 'getCommentByIdForUpdate'
  | 'createComment'
  | 'editComment'
  | 'softDeleteComment'
  | 'setHiddenState'
  | 'incrementVoteCount'
  | 'incrementRepliesCount'
  | 'countReplies'
  | 'upsertVote'
  | 'removeVote'
  | 'getUserVoteForComment'
  | 'getAuthorForComment'
  | 'createReport'
  | 'reviewReport'
  | 'listComments'
  | 'listMyComments'
  | 'listReports'
  | 'transactionally'
  | 'getUsername'
  | 'getUsernamesForUsers'
  | 'reconcileCounters'
> {}

const createMockRepo = (): jest.Mocked<MockRepo> => ({
  getCommentById: jest.fn(),
  getCommentByIdForUpdate: jest.fn(),
  createComment: jest.fn(),
  editComment: jest.fn(),
  softDeleteComment: jest.fn(),
  setHiddenState: jest.fn(),
  incrementVoteCount: jest.fn(),
  incrementRepliesCount: jest.fn(),
  countReplies: jest.fn(),
  upsertVote: jest.fn(),
  removeVote: jest.fn(),
  getUserVoteForComment: jest.fn(),
  getAuthorForComment: jest.fn(),
  createReport: jest.fn(),
  reviewReport: jest.fn(),
  listComments: jest.fn(),
  listMyComments: jest.fn(),
  listReports: jest.fn(),
  transactionally: jest.fn(async <T>(fn: (tx: { readonly __brand: 'Db' }) => Promise<T>) =>
    fn({} as never),
  ) as unknown as jest.Mocked<MockRepo>['transactionally'],
  getUsername: jest.fn(),
  getUsernamesForUsers: jest.fn(),
  reconcileCounters: jest.fn(),
});

const createMockQuizExistence = (): jest.Mocked<QuizExistencePort> => ({
  exists: jest.fn(),
});

const createMockUserExistence = (): jest.Mocked<UserExistencePort> => ({
  exists: jest.fn(),
  findByUsernames: jest.fn(),
});

const createMockEventBus = () => {
  const bus = {
    subscribe: jest.fn(() => () => undefined),
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
  };
  return bus;
};

describe('CommentService', () => {
  let service: CommentService;
  let repo: jest.Mocked<MockRepo>;
  let quizExistence: jest.Mocked<QuizExistencePort>;
  let userExistence: jest.Mocked<UserExistencePort>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let logger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    mockIsPostgresUniqueViolation.mockReset();
    repo = createMockRepo();
    quizExistence = createMockQuizExistence();
    userExistence = createMockUserExistence();
    eventBus = createMockEventBus();
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    service = new CommentService(
      repo as unknown as CommentRepositoryPort,
      quizExistence,
      userExistence,
      eventBus as unknown as CommentDomainEventBusPort,
      logger as unknown as never,
    );
  });

  describe('getComment', () => {
    it('returns the repository projection', async () => {
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);

      const result = await service.getComment({ commentId: COMMENT_ID });

      expect(repo.getCommentById).toHaveBeenCalledWith(COMMENT_ID);
      expect(result).toBe(mockCommentView);
    });

    it('returns null when the repository returns null', async () => {
      repo.getCommentById.mockResolvedValueOnce(null);
      const result = await service.getComment({ commentId: COMMENT_ID });
      expect(result).toBeNull();
    });
  });

  describe('createComment', () => {
    const params: CreateCommentParams = {
      quizId: QUIZ_ID,
      authorId: USER_ID,
      parentCommentId: null,
      body: 'Hello @bob',
    };

    beforeEach(() => {
      quizExistence.exists.mockResolvedValue(true);
      repo.createComment.mockResolvedValue(mockCommentView);
      repo.getAuthorForComment.mockResolvedValue(mockAuthor);
      userExistence.findByUsernames.mockResolvedValue([]);
    });

    it('throws QuizNotFoundError when the quiz does not exist', async () => {
      quizExistence.exists.mockResolvedValueOnce(false);

      await expect(service.createComment(params)).rejects.toThrow(/Quiz not found/);
      expect(repo.createComment).not.toHaveBeenCalled();
    });

    it('creates a top-level comment and emits comment_created', async () => {
      const result = await service.createComment(params);

      expect(repo.createComment).toHaveBeenCalledWith(params, expect.anything());
      expect(eventBus.emitCommentCreated).toHaveBeenCalledWith({
        eventType: 'comment_created',
        commentId: COMMENT_ID,
        quizId: QUIZ_ID,
        parentCommentId: null,
        authorId: USER_ID,
        authorUsername: 'alice',
        parentCommentAuthorId: null,
        isReply: false,
        timestamp: expect.any(Date),
      });
      expect(result).toBe(mockCommentView);
    });

    it('emits comment_mentioned for each unique mentioned user other than the author', async () => {
      userExistence.findByUsernames.mockResolvedValueOnce([mentionedUser]);

      await service.createComment(params);

      expect(eventBus.emitCommentMentioned).toHaveBeenCalledTimes(1);
      expect(eventBus.emitCommentMentioned).toHaveBeenCalledWith({
        eventType: 'comment_mentioned',
        commentId: COMMENT_ID,
        quizId: QUIZ_ID,
        mentionedUserId: mentionedUser.userId,
        mentionedUsername: 'bob',
        authorId: USER_ID,
        authorUsername: 'alice',
        timestamp: expect.any(Date),
      });
    });

    it('does not emit mention events for the author themselves', async () => {
      userExistence.findByUsernames.mockResolvedValueOnce([
        { ...mentionedUser, userId: USER_ID, username: 'alice' },
      ]);

      await service.createComment(params);

      expect(eventBus.emitCommentMentioned).not.toHaveBeenCalled();
    });

    describe('replies', () => {
      const replyParams: CreateCommentParams = {
        quizId: QUIZ_ID,
        authorId: USER_ID,
        parentCommentId: PARENT_ID,
        body: 'Reply',
      };

      beforeEach(() => {
        repo.getCommentByIdForUpdate.mockResolvedValue(parentCommentView);
        repo.countReplies.mockResolvedValue(0);
      });

      it('locks the parent row, increments replies count, and emits the reply event', async () => {
        const reply = { ...mockCommentView, parentCommentId: PARENT_ID };
        repo.createComment.mockResolvedValueOnce(reply);
        // `createComment` calls `getCommentById` (non-tx variant) to
        // resolve the parent's author id for the event payload.
        repo.getCommentById.mockResolvedValueOnce(parentCommentView);

        const result = await service.createComment(replyParams);

        expect(repo.getCommentByIdForUpdate).toHaveBeenCalledWith(PARENT_ID, expect.anything());
        expect(repo.incrementRepliesCount).toHaveBeenCalledWith(PARENT_ID, 1, expect.anything());
        expect(eventBus.emitCommentCreated).toHaveBeenCalledWith(
          expect.objectContaining({
            parentCommentId: PARENT_ID,
            isReply: true,
            parentCommentAuthorId: USER_ID,
          }),
        );
        expect(result).toBe(reply);
      });

      it('rejects when the parent belongs to a different quiz', async () => {
        repo.getCommentByIdForUpdate.mockResolvedValueOnce({
          ...parentCommentView,
          quizId: 'another-quiz',
        });

        await expect(service.createComment(replyParams)).rejects.toBeInstanceOf(
          ParentCommentCrossThreadError,
        );
        expect(repo.createComment).not.toHaveBeenCalled();
      });

      it('rejects when the parent is itself a reply (two-level rule)', async () => {
        repo.getCommentByIdForUpdate.mockResolvedValueOnce({
          ...parentCommentView,
          parentCommentId: 'nested-parent',
        });

        await expect(service.createComment(replyParams)).rejects.toBeInstanceOf(
          ParentCommentCrossThreadError,
        );
      });

      it('rejects when the parent is hidden or soft-deleted', async () => {
        repo.getCommentByIdForUpdate.mockResolvedValueOnce({
          ...parentCommentView,
          isHidden: true,
        });

        await expect(service.createComment(replyParams)).rejects.toBeInstanceOf(
          CommentNotFoundError,
        );
      });

      it('rejects when the reply cap is reached', async () => {
        repo.countReplies.mockResolvedValueOnce(MAX_REPLIES_PER_COMMENT);

        await expect(service.createComment(replyParams)).rejects.toBeInstanceOf(
          ReplyLimitExceededError,
        );
      });
    });
  });

  describe('editComment', () => {
    it('updates the comment and emits comment_edited', async () => {
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);
      repo.editComment.mockResolvedValueOnce({ ...mockCommentView, body: 'Edited' });

      const result = await service.editComment({
        commentId: COMMENT_ID,
        authorId: USER_ID,
        body: 'Edited',
      });

      expect(eventBus.emitCommentEdited).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'comment_edited',
          commentId: COMMENT_ID,
          quizId: QUIZ_ID,
          authorId: USER_ID,
        }),
      );
      expect(result.body).toBe('Edited');
    });

    it('rejects when the caller is not the author', async () => {
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);

      await expect(
        service.editComment({ commentId: COMMENT_ID, authorId: 'someone-else', body: 'X' }),
      ).rejects.toBeInstanceOf(CommentForbiddenError);
    });

    it('rejects when the comment is hidden or deleted', async () => {
      repo.getCommentById.mockResolvedValueOnce({ ...mockCommentView, deletedAt: NOW });

      await expect(
        service.editComment({ commentId: COMMENT_ID, authorId: USER_ID, body: 'X' }),
      ).rejects.toBeInstanceOf(CommentNotFoundError);
    });
  });

  describe('deleteComment', () => {
    it('is idempotent — returns early if the comment is already deleted', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce({
        ...mockCommentView,
        deletedAt: NOW,
      });

      await service.deleteComment({ commentId: COMMENT_ID, authorId: USER_ID });

      expect(repo.softDeleteComment).not.toHaveBeenCalled();
      expect(eventBus.emitCommentDeleted).not.toHaveBeenCalled();
    });

    it('decrements replies count on the parent and emits comment_deleted', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce({
        ...mockCommentView,
        parentCommentId: PARENT_ID,
      });

      await service.deleteComment({ commentId: COMMENT_ID, authorId: USER_ID });

      expect(repo.softDeleteComment).toHaveBeenCalled();
      expect(repo.incrementRepliesCount).toHaveBeenCalledWith(PARENT_ID, -1, expect.anything());
      expect(eventBus.emitCommentDeleted).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'comment_deleted',
          commentId: COMMENT_ID,
          authorId: USER_ID,
        }),
      );
    });
  });

  describe('vote', () => {
    it('rejects self-votes', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);

      await expect(
        service.vote({ userId: USER_ID, commentId: COMMENT_ID, value: 'upvote' }),
      ).rejects.toBeInstanceOf(SelfVoteError);
    });

    it('increments the upvote count on first upvote', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);
      repo.getUserVoteForComment.mockResolvedValueOnce(null);

      await service.vote({ userId: VOTER_ID, commentId: COMMENT_ID, value: 'upvote' });

      expect(repo.upsertVote).toHaveBeenCalled();
      expect(repo.incrementVoteCount).toHaveBeenCalledWith(COMMENT_ID, 1, 0, expect.anything());
      expect(eventBus.emitVoteCast).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'vote_cast' }),
      );
    });

    it('toggles off when the same value is re-applied', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);
      repo.getUserVoteForComment.mockResolvedValueOnce('upvote');

      await service.vote({ userId: VOTER_ID, commentId: COMMENT_ID, value: 'upvote' });

      expect(repo.removeVote).toHaveBeenCalled();
      expect(repo.incrementVoteCount).toHaveBeenCalledWith(COMMENT_ID, -1, 0, expect.anything());
    });

    it('flips the bucket when the value changes', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);
      repo.getUserVoteForComment.mockResolvedValueOnce('upvote');

      await service.vote({ userId: VOTER_ID, commentId: COMMENT_ID, value: 'downvote' });

      expect(repo.upsertVote).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'downvote' }),
        expect.anything(),
      );
      expect(repo.incrementVoteCount).toHaveBeenCalledWith(COMMENT_ID, -1, 1, expect.anything());
    });
  });

  describe('removeVote', () => {
    it('is a no-op for the database when the viewer had no vote (still emits the event)', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);
      repo.getUserVoteForComment.mockResolvedValueOnce(null);

      await service.removeVote({ userId: VOTER_ID, commentId: COMMENT_ID });

      expect(repo.removeVote).not.toHaveBeenCalled();
      expect(repo.incrementVoteCount).not.toHaveBeenCalled();
      // The event is emitted unconditionally because the controller
      // contract says idempotency is observable as a 204, not as a
      // suppressed event.
      expect(eventBus.emitVoteRemoved).toHaveBeenCalled();
    });

    it('removes the vote and decrements the matching bucket', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);
      repo.getUserVoteForComment.mockResolvedValueOnce('downvote');

      await service.removeVote({ userId: VOTER_ID, commentId: COMMENT_ID });

      expect(repo.removeVote).toHaveBeenCalled();
      expect(repo.incrementVoteCount).toHaveBeenCalledWith(COMMENT_ID, 0, -1, expect.anything());
      expect(eventBus.emitVoteRemoved).toHaveBeenCalled();
    });
  });

  describe('reportComment', () => {
    it('opens a report and emits comment_reported with self-contained payload', async () => {
      const report: ReportView = {
        reportId: REPORT_ID,
        reporterId: REPORTER_ID,
        commentId: COMMENT_ID,
        reason: 'spam',
        details: null,
        status: 'open',
        reviewedByUserId: null,
        reviewedAt: null,
        actionTaken: false,
        createdAt: NOW,
        updatedAt: NOW,
      };
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);
      repo.createReport.mockResolvedValueOnce(report);

      const result = await service.reportComment({
        reporterId: REPORTER_ID,
        commentId: COMMENT_ID,
        reason: 'spam',
        details: null,
      });

      expect(eventBus.emitCommentReported).toHaveBeenCalledWith({
        eventType: 'comment_reported',
        reportId: REPORT_ID,
        commentId: COMMENT_ID,
        quizId: QUIZ_ID,
        commentExcerpt: 'Hello',
        reporterId: REPORTER_ID,
        reason: 'spam',
        timestamp: expect.any(Date),
      });
      expect(result).toBe(report);
    });

    it('rejects self-reports', async () => {
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);

      await expect(
        service.reportComment({
          reporterId: USER_ID,
          commentId: COMMENT_ID,
          reason: 'spam',
          details: null,
        }),
      ).rejects.toBeInstanceOf(SelfReportError);
    });

    it('translates a unique-violation into DuplicateReportError', async () => {
      const error = new Error('unique_violation');
      mockIsPostgresUniqueViolation.mockReturnValueOnce(true);
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);
      repo.createReport.mockRejectedValueOnce(error);

      await expect(
        service.reportComment({
          reporterId: REPORTER_ID,
          commentId: COMMENT_ID,
          reason: 'spam',
          details: null,
        }),
      ).rejects.toBeInstanceOf(DuplicateReportError);
    });
  });

  describe('reviewReport', () => {
    it('emits report_reviewed after the persistent commit', async () => {
      repo.reviewReport.mockResolvedValueOnce({
        reportId: REPORT_ID,
        reporterId: REPORTER_ID,
        commentId: COMMENT_ID,
        reason: 'spam',
        details: null,
        status: 'actioned',
        reviewedByUserId: MODERATOR_ID,
        reviewedAt: NOW,
        actionTaken: true,
        createdAt: NOW,
        updatedAt: NOW,
      });

      const result = await service.reviewReport({
        reportId: REPORT_ID,
        reviewerId: MODERATOR_ID,
        status: 'actioned',
        actionTaken: true,
      });

      expect(eventBus.emitReportReviewed).toHaveBeenCalledWith({
        eventType: 'report_reviewed',
        reportId: REPORT_ID,
        reviewerId: MODERATOR_ID,
        status: 'actioned',
        actionTaken: true,
        timestamp: expect.any(Date),
      });
      expect(result.status).toBe('actioned');
    });
  });

  describe('moderation', () => {
    it('hideComment rejects non-moderators', async () => {
      await expect(
        service.hideComment({ commentId: COMMENT_ID, moderatorId: VOTER_ID }, { role: 'user' }),
      ).rejects.toBeInstanceOf(ModeratorRequiredError);
    });

    it('hideComment accepts moderators and emits comment_hidden', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);

      await service.hideComment(
        { commentId: COMMENT_ID, moderatorId: MODERATOR_ID },
        { role: 'moderator' },
      );

      expect(repo.setHiddenState).toHaveBeenCalledWith(
        expect.objectContaining({ hidden: true }),
        expect.anything(),
      );
      expect(eventBus.emitCommentHidden).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'comment_hidden',
          commentId: COMMENT_ID,
          moderatorId: MODERATOR_ID,
        }),
      );
    });

    it('restoreComment accepts moderators and emits comment_restored', async () => {
      repo.getCommentByIdForUpdate.mockResolvedValueOnce(mockCommentView);
      repo.getCommentById.mockResolvedValueOnce(mockCommentView);

      await service.restoreComment(
        { commentId: COMMENT_ID, moderatorId: MODERATOR_ID },
        { role: 'admin' },
      );

      expect(repo.setHiddenState).toHaveBeenCalledWith(
        expect.objectContaining({ hidden: false }),
        expect.anything(),
      );
      expect(eventBus.emitCommentRestored).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'comment_restored' }),
      );
    });
  });
});
