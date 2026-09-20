import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const CommentProblemCodeMapping = {
  COMMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/comment-not-found',
  },
  COMMENT_QUIZ_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/comment-quiz-not-found',
  },
  COMMENT_REPORT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/comment-report-not-found',
  },
  COMMENT_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-forbidden',
  },
  COMMENT_SELF_VOTE: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-self-vote',
  },
  COMMENT_SELF_REPORT: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-self-report',
  },
  COMMENT_MODERATOR_REQUIRED: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-moderator-required',
  },
  COMMENT_REPLY_LIMIT_EXCEEDED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/comment-reply-limit-exceeded',
  },
  COMMENT_DUPLICATE_REPORT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/comment-duplicate-report',
  },
  COMMENT_PARENT_COMMENT_CROSS_THREAD: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/comment-parent-comment-cross-thread',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
