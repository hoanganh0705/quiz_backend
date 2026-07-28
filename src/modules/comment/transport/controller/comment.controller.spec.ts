/**
 * CommentController unit tests.
 *
 * The controller is a thin HTTP-boundary layer. We exercise its public
 * methods directly (the framework decorators are exercised by the
 * integration / e2e suite, not here). The spec verifies:
 *   - the presenter is invoked with the application service output
 *     for read / write endpoints,
 *   - `null` from `getComment` is translated into `CommentNotFoundError`
 *     (the public read contract),
 *   - write endpoints return `void` without going through the presenter.
 */

import { CommentController } from './comment.controller';
import { CommentApplicationService } from '../../application/comment-application.service';
import { CommentPresenter } from '../presenters/comment.presenter';
import { CommentNotFoundError } from '../../domain/errors';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { CommentView, MyCommentView, ReportView } from '../../domain/types';
import type { EditCommentDto, VoteDto, ReportCommentDto } from '../../dto/request';

const user: JwtPayload = { sub: '11111111-1111-7111-8111-111111111111', role: 'user' };
const moderator: JwtPayload = { sub: '22222222-2222-7222-8222-222222222222', role: 'moderator' };

const commentId = '33333333-3333-7333-8333-333333333333';

const mockCommentView: CommentView = {
  id: commentId,
  quizId: '55555555-5555-7555-8555-555555555555',
  authorId: user.sub,
  parentCommentId: null,
  body: 'hi',
  isHidden: false,
  hiddenById: null,
  hiddenAt: null,
  votesCount: 0,
  upvotesCount: 0,
  downvotesCount: 0,
  repliesCount: 0,
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z',
  deletedAt: null,
  author: {
    userId: user.sub,
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
  },
};

describe('CommentController', () => {
  let controller: CommentController;
  let application: jest.Mocked<CommentApplicationService>;
  let presenter: jest.Mocked<CommentPresenter>;

  beforeEach(() => {
    application = {
      getComment: jest.fn(),
      editComment: jest.fn(),
      deleteComment: jest.fn(),
      vote: jest.fn(),
      removeVote: jest.fn(),
      reportComment: jest.fn(),
      hideComment: jest.fn(),
      restoreComment: jest.fn(),
    } as unknown as jest.Mocked<CommentApplicationService>;

    presenter = {
      getComment: jest.fn(),
      editComment: jest.fn(),
      createReport: jest.fn(),
      hideComment: jest.fn(),
      restoreComment: jest.fn(),
    } as unknown as jest.Mocked<CommentPresenter>;

    controller = new CommentController(application, presenter);
  });

  describe('getComment', () => {
    it('returns the presenter output for an existing comment', async () => {
      application.getComment.mockResolvedValueOnce(mockCommentView);
      presenter.getComment.mockReturnValueOnce({ id: commentId } as never);

      const result = await controller.getComment(user, commentId);

      expect(application.getComment).toHaveBeenCalledWith(user, commentId);
      expect(presenter.getComment).toHaveBeenCalledWith(mockCommentView);
      expect(result).toEqual({ id: commentId });
    });

    it('translates a null result into CommentNotFoundError', async () => {
      application.getComment.mockResolvedValueOnce(null);

      await expect(controller.getComment(user, commentId)).rejects.toBeInstanceOf(
        CommentNotFoundError,
      );
      expect(presenter.getComment).not.toHaveBeenCalled();
    });
  });

  describe('editComment', () => {
    it('delegates to the application and presents the result', async () => {
      const dto: EditCommentDto = { body: 'edited' };
      application.editComment.mockResolvedValueOnce(mockCommentView);
      presenter.editComment.mockReturnValueOnce({ id: commentId } as never);

      const result = await controller.editComment(user, commentId, dto);

      expect(application.editComment).toHaveBeenCalledWith(user, commentId, dto);
      expect(presenter.editComment).toHaveBeenCalledWith(mockCommentView);
      expect(result).toEqual({ id: commentId });
    });
  });

  describe('deleteComment', () => {
    it('returns void without touching the presenter', async () => {
      application.deleteComment.mockResolvedValueOnce(undefined);

      await expect(controller.deleteComment(user, commentId)).resolves.toBeUndefined();
      expect(application.deleteComment).toHaveBeenCalledWith(user, commentId);
    });
  });

  describe('vote / removeVote', () => {
    it('delegates vote to the application with the cast value', async () => {
      const dto: VoteDto = { value: 'upvote' };
      application.vote.mockResolvedValueOnce(undefined);

      await controller.castVote(user, commentId, dto);

      expect(application.vote).toHaveBeenCalledWith(user, commentId, 'upvote');
    });

    it('delegates vote-removal to the application', async () => {
      application.removeVote.mockResolvedValueOnce(undefined);

      await controller.removeVote(user, commentId);

      expect(application.removeVote).toHaveBeenCalledWith(user, commentId);
    });
  });

  describe('reportComment', () => {
    it('delegates and presents the created report', async () => {
      const dto: ReportCommentDto = { reason: 'spam', details: null };
      const report: ReportView = {
        reportId: '66666666-6666-7666-8666-666666666666',
        reporterId: user.sub,
        commentId,
        reason: 'spam',
        details: null,
        status: 'open',
        reviewedByUserId: null,
        reviewedAt: null,
        actionTaken: false,
        createdAt: '2026-07-26T00:00:00.000Z',
        updatedAt: '2026-07-26T00:00:00.000Z',
      };
      application.reportComment.mockResolvedValueOnce(report);
      presenter.createReport.mockReturnValueOnce({ reportId: report.reportId } as never);

      const result = await controller.reportComment(user, commentId, dto);

      expect(application.reportComment).toHaveBeenCalledWith(user, commentId, dto);
      expect(presenter.createReport).toHaveBeenCalledWith(report);
      expect(result).toEqual({ reportId: report.reportId });
    });
  });

  describe('moderator actions', () => {
    const mockModerationResult = {
      commentId,
      isHidden: true,
      changed: true,
    };

    it('hideComment delegates to the application with the JWT payload and returns presenter result', async () => {
      application.hideComment.mockResolvedValueOnce(mockModerationResult);
      presenter.hideComment.mockReturnValueOnce({ data: mockModerationResult, meta: { timestamp: '2026-07-28T00:00:00.000Z' } } as never);

      const result = await controller.hideComment(moderator, commentId);

      expect(application.hideComment).toHaveBeenCalledWith(moderator, commentId);
      expect(presenter.hideComment).toHaveBeenCalledWith(mockModerationResult);
      expect(result).toHaveProperty('data');
    });

    it('restoreComment delegates to the application with the JWT payload and returns presenter result', async () => {
      const mockRestoreResult = { ...mockModerationResult, isHidden: false };
      application.restoreComment.mockResolvedValueOnce(mockRestoreResult);
      presenter.restoreComment.mockReturnValueOnce({ data: mockRestoreResult, meta: { timestamp: '2026-07-28T00:00:00.000Z' } } as never);

      const result = await controller.restoreComment(moderator, commentId);

      expect(application.restoreComment).toHaveBeenCalledWith(moderator, commentId);
      expect(presenter.restoreComment).toHaveBeenCalledWith(mockRestoreResult);
      expect(result).toHaveProperty('data');
    });
  });
});
