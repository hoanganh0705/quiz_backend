import type { AuthorView } from '../../domain/types';
import type {
  CommentView,
  CommentWithRepliesView,
  MyCommentView,
  ReportView,
} from '../../domain/types';
import type { AuthorDto } from '../../dto/response/author.dto';
import type { CommentDto, CommentWithRepliesDto } from '../../dto/response/comment.dto';
import type { MyCommentDto } from '../../dto/response/my-comment.dto';
import type { ReportDto } from '../../dto/response/report.dto';

/**
 * Project-only mappers from the comment module's domain read shapes
 * to the wire-shape DTOs. Each is a 1:1 field-level transformation
 * — no business logic, no I/O. Kept in one file so every projection
 * is reviewable in a single diff.
 */

export function toAuthorDto(author: AuthorView): AuthorDto {
  return {
    userId: author.userId,
    username: author.username,
    displayName: author.displayName,
    avatarUrl: author.avatarUrl,
  };
}

export function toCommentDto(view: CommentView): CommentDto {
  return {
    id: view.id,
    quizId: view.quizId,
    authorId: view.authorId,
    author: toAuthorDto(view.author),
    parentCommentId: view.parentCommentId,
    body: view.body,
    isHidden: view.isHidden,
    hiddenById: view.hiddenById,
    hiddenAt: view.hiddenAt,
    votesCount: view.votesCount,
    upvotesCount: view.upvotesCount,
    downvotesCount: view.downvotesCount,
    repliesCount: view.repliesCount,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    deletedAt: view.deletedAt,
  };
}

export function toCommentWithRepliesDto(view: CommentWithRepliesView): CommentWithRepliesDto {
  return {
    ...toCommentDto(view),
    replies: view.replies.map(toCommentDto),
    userVote: view.userVote,
  };
}

export function toMyCommentDto(view: MyCommentView): MyCommentDto {
  return {
    id: view.commentId,
    quizId: view.quizId,
    quizTitle: view.quizTitle,
    body: view.body,
    votesCount: view.votesCount,
    repliesCount: view.repliesCount,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

export function toReportDto(view: ReportView): ReportDto {
  return {
    reportId: view.reportId,
    reporterId: view.reporterId,
    commentId: view.commentId,
    reason: view.reason,
    details: view.details,
    status: view.status,
    reviewedByUserId: view.reviewedByUserId,
    reviewedAt: view.reviewedAt,
    actionTaken: view.actionTaken,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}
