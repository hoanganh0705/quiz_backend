/**
 * CommentApplicationService unit tests.
 *
 * Verifies:
 *   - cursor (de)serialization at the application boundary
 *   - JWT subject resolution for write paths
 *   - audit log writes for moderator actions (hide, restore, review)
 *   - delegation to the domain service for everything else
 */
import { CommentApplicationService } from './comment-application.service';
import type { CommentService } from '../domain/services/comment.service';
import type { CommentModeratorAuditService } from '../infrastructure/audit/comment-moderator-audit.service';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import type {
  AuthorView,
  Comment,
  CommentView,
  CommentWithRepliesView,
  MyCommentView,
  ReportView,
} from '../domain/types';

const user: JwtPayload = { sub: '11111111-1111-7111-8111-111111111111', role: 'user' };
const moderator: JwtPayload = { sub: '22222222-2222-7222-8222-222222222222', role: 'moderator' };

const mockAuthor: AuthorView = {
  userId: '11111111-1111-7111-8111-111111111111',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
};

const commentId = '33333333-3333-7333-8333-333333333333';
const parentCommentId = '44444444-4444-7444-8444-444444444444';
const quizId = '55555555-5555-7555-8555-555555555555';
const reportId = '66666666-6666-7666-8666-666666666666';
const userId2 = '77777777-7777-7777-8777-777777777777';
const createdAt = '2026-07-26T00:00:00.000Z';

const mockComment: Comment = {
  id: commentId,
  quizId,
  authorId: '11111111-1111-7111-8111-111111111111',
  parentCommentId: null,
  body: 'Great question!',
  isHidden: false,
  hiddenById: null,
  hiddenAt: null,
  votesCount: 0,
  upvotesCount: 0,
  downvotesCount: 0,
  repliesCount: 0,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const mockCommentView: CommentView = { ...mockComment, author: mockAuthor };

const mockWithReplies: CommentWithRepliesView = {
  ...mockCommentView,
  replies: [],
  userVote: null,
};

const mockMyComment: MyCommentView = {
  commentId,
  quizId,
  quizTitle: 'Quiz Title',
  body: 'Great question!',
  votesCount: 0,
  repliesCount: 0,
  createdAt,
  updatedAt: createdAt,
};

const mockReport: ReportView = {
  reportId,
  reporterId: '11111111-1111-7111-8111-111111111111',
  commentId,
  reason: 'spam',
  details: null,
  status: 'open',
  reviewedByUserId: null,
  reviewedAt: null,
  actionTaken: false,
  createdAt,
  updatedAt: createdAt,
};

const createMockCommentService = (): jest.Mocked<
  Pick<
    CommentService,
    | 'getComment'
    | 'listComments'
    | 'listMyComments'
    | 'listReports'
    | 'createComment'
    | 'editComment'
    | 'deleteComment'
    | 'vote'
    | 'removeVote'
    | 'reportComment'
    | 'reviewReport'
    | 'hideComment'
    | 'restoreComment'
  >
> => ({
  getComment: jest.fn(),
  listComments: jest.fn(),
  listMyComments: jest.fn(),
  listReports: jest.fn(),
  createComment: jest.fn(),
  editComment: jest.fn(),
  deleteComment: jest.fn(),
  vote: jest.fn(),
  removeVote: jest.fn(),
  reportComment: jest.fn(),
  reviewReport: jest.fn(),
  hideComment: jest.fn(),
  restoreComment: jest.fn(),
});

const createMockAudit = (): jest.Mocked<CommentModeratorAuditService> =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<CommentModeratorAuditService>;

describe('CommentApplicationService', () => {
  let service: CommentApplicationService;
  let commentService: ReturnType<typeof createMockCommentService>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    commentService = createMockCommentService();
    audit = createMockAudit();
    service = new CommentApplicationService(
      commentService as unknown as CommentService,
      audit as unknown as CommentModeratorAuditService,
    );
  });

  describe('getComment', () => {
    it('delegates to the domain service and returns the view projection', async () => {
      commentService.getComment.mockResolvedValueOnce(mockCommentView);

      const result = await service.getComment(user, commentId);

      expect(commentService.getComment).toHaveBeenCalledWith({ commentId });
      expect(result).toBe(mockCommentView);
    });

    it('returns null when the domain service returns null', async () => {
      commentService.getComment.mockResolvedValueOnce(null);

      const result = await service.getComment(user, commentId);

      expect(result).toBeNull();
    });
  });

  describe('listQuizComments', () => {
    it('serializes the next cursor on a hasNextPage page', async () => {
      const cursor = encodeBase64JsonCursor({ createdAt, id: commentId });
      commentService.listComments.mockResolvedValueOnce({
        items: [mockWithReplies],
        hasNextPage: true,
        nextCursor: { createdAt, id: commentId },
      });

      const result = await service.listQuizComments(user, quizId, { cursor });

      expect(commentService.listComments).toHaveBeenCalledWith({
        quizId,
        limit: 20,
        cursor: { createdAt, id: commentId },
        viewerId: user.sub,
      });
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBe(cursor);
    });

    it('returns a null cursor on the last page', async () => {
      commentService.listComments.mockResolvedValueOnce({
        items: [mockWithReplies],
        hasNextPage: false,
        nextCursor: null,
      });

      const result = await service.listQuizComments(undefined, quizId, {});

      expect(commentService.listComments).toHaveBeenCalledWith({
        quizId,
        limit: 20,
        cursor: null,
        viewerId: null,
      });
      expect(result.pagination.nextCursor).toBeNull();
    });
  });

  describe('listMyComments / listUserComments', () => {
    it('parses the incoming cursor and serializes the outgoing one', async () => {
      const cursor = encodeBase64JsonCursor({ createdAt, id: commentId });
      commentService.listMyComments.mockResolvedValueOnce({
        items: [mockMyComment],
        limit: 20,
        hasNextPage: true,
        nextCursor: { createdAt, id: commentId },
      });

      const result = await service.listMyComments(user, { cursor });

      expect(commentService.listMyComments).toHaveBeenCalledWith({
        userId: user.sub,
        limit: 20,
        cursor: { createdAt, id: commentId },
      });
      expect(result.pagination.nextCursor).toBe(cursor);
    });

    it('exposes the same surface for /users/:userId/comments', async () => {
      commentService.listMyComments.mockResolvedValueOnce({
        items: [mockMyComment],
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });

      const result = await service.listUserComments(undefined, userId2, {});

      expect(commentService.listMyComments).toHaveBeenCalledWith({
        userId: userId2,
        limit: 20,
        cursor: null,
      });
      expect(result.pagination.nextCursor).toBeNull();
    });
  });

  describe('listReports', () => {
    it('serializes the report cursor and forwards the status filter', async () => {
      const cursor = encodeBase64JsonCursor({ createdAt, id: reportId });
      commentService.listReports.mockResolvedValueOnce({
        items: [mockReport],
        hasNextPage: true,
        nextCursor: { createdAt, id: reportId },
      });

      const result = await service.listReports(moderator, { status: 'open', cursor });

      expect(commentService.listReports).toHaveBeenCalledWith({
        status: 'open',
        limit: 20,
        cursor: { createdAt, id: reportId },
      });
      expect(result.pagination.nextCursor).toBe(cursor);
    });
  });

  describe('createComment', () => {
    it('passes the JWT subject as authorId and the body through unchanged', async () => {
      commentService.createComment.mockResolvedValueOnce(mockCommentView);

      await service.createComment(user, quizId, { body: 'Hello' });

      expect(commentService.createComment).toHaveBeenCalledWith({
        quizId,
        authorId: user.sub,
        parentCommentId: null,
        body: 'Hello',
      });
    });

    it('forwards the parentCommentId for replies', async () => {
      commentService.createComment.mockResolvedValueOnce(mockCommentView);

      await service.createComment(user, quizId, {
        body: 'Reply',
        parentCommentId,
      });

      expect(commentService.createComment).toHaveBeenCalledWith({
        quizId,
        authorId: user.sub,
        parentCommentId,
        body: 'Reply',
      });
    });
  });

  describe('editComment / deleteComment', () => {
    it('edits with the JWT subject as authorId', async () => {
      commentService.editComment.mockResolvedValueOnce(mockCommentView);

      await service.editComment(user, commentId, { body: 'Edited' });

      expect(commentService.editComment).toHaveBeenCalledWith({
        commentId,
        authorId: user.sub,
        body: 'Edited',
      });
    });

    it('deletes with the JWT subject as authorId', async () => {
      commentService.deleteComment.mockResolvedValueOnce(undefined);

      await service.deleteComment(user, commentId);

      expect(commentService.deleteComment).toHaveBeenCalledWith({
        commentId,
        authorId: user.sub,
      });
    });
  });

  describe('vote / removeVote', () => {
    it('passes the JWT subject as the voter id', async () => {
      commentService.vote.mockResolvedValueOnce(undefined);

      await service.vote(user, commentId, 'upvote');

      expect(commentService.vote).toHaveBeenCalledWith({
        userId: user.sub,
        commentId,
        value: 'upvote',
      });
    });

    it('forwards removeVote', async () => {
      commentService.removeVote.mockResolvedValueOnce(undefined);

      await service.removeVote(user, commentId);

      expect(commentService.removeVote).toHaveBeenCalledWith({
        userId: user.sub,
        commentId,
      });
    });
  });

  describe('reportComment / reviewReport', () => {
    it('opens a report and returns the report view', async () => {
      commentService.reportComment.mockResolvedValueOnce(mockReport);

      const result = await service.reportComment(user, commentId, {
        reason: 'spam',
        details: 'Context',
      });

      expect(commentService.reportComment).toHaveBeenCalledWith({
        reporterId: user.sub,
        commentId,
        reason: 'spam',
        details: 'Context',
      });
      expect(result).toBe(mockReport);
    });

    it('reviews a report and writes an audit log entry', async () => {
      commentService.reviewReport.mockResolvedValueOnce(mockReport);

      const result = await service.reviewReport(moderator, reportId, {
        status: 'actioned',
        actionTaken: true,
      });

      expect(commentService.reviewReport).toHaveBeenCalledWith({
        reportId,
        reviewerId: moderator.sub,
        status: 'actioned',
        actionTaken: true,
      });
      expect(audit.log).toHaveBeenCalledWith({
        actorId: moderator.sub,
        actorRole: 'moderator',
        action: 'review_report',
        targetType: 'comment',
        targetId: commentId,
        result: 'actioned',
      });
      expect(result).toBe(mockReport);
    });

    it('defaults actionTaken to false when omitted', async () => {
      commentService.reviewReport.mockResolvedValueOnce(mockReport);

      await service.reviewReport(moderator, reportId, { status: 'dismissed' });

      expect(commentService.reviewReport).toHaveBeenCalledWith({
        reportId,
        reviewerId: moderator.sub,
        status: 'dismissed',
        actionTaken: false,
      });
    });
  });

  describe('hideComment / restoreComment', () => {
    it('hides a comment and writes the audit log', async () => {
      commentService.hideComment.mockResolvedValueOnce(undefined);

      await service.hideComment(moderator, commentId);

      expect(commentService.hideComment).toHaveBeenCalledWith(
        { commentId, moderatorId: moderator.sub },
        moderator,
      );
      expect(audit.log).toHaveBeenCalledWith({
        actorId: moderator.sub,
        actorRole: 'moderator',
        action: 'hide_comment',
        targetType: 'comment',
        targetId: commentId,
      });
    });

    it('restores a comment and writes the audit log', async () => {
      commentService.restoreComment.mockResolvedValueOnce(undefined);

      await service.restoreComment(moderator, commentId);

      expect(commentService.restoreComment).toHaveBeenCalledWith(
        { commentId, moderatorId: moderator.sub },
        moderator,
      );
      expect(audit.log).toHaveBeenCalledWith({
        actorId: moderator.sub,
        actorRole: 'moderator',
        action: 'restore_comment',
        targetType: 'comment',
        targetId: commentId,
      });
    });
  });
});
