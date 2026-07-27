import { EXAMPLE_TIMESTAMP } from './_timestamp';

/**
 * Comment module success-response examples.
 *
 * Each constant matches the runtime envelope shape produced by
 * `CommentPresenter`. Examples are referenced by
 * `comment-swagger-decorators.ts`.
 *
 * Wire-format mirrors the DTO contract documented in
 * `src/modules/comment/dto/response/`. UUIDs use the v7 values
 * already established by other modules (e.g. review).
 */

const COMMENT_ID_A = '880e8400-e29b-71d4-a716-446655440001';
const COMMENT_ID_B = '880e8400-e29b-71d4-a716-446655440002';
const QUIZ_ID = '660e8400-e29b-71d4-a716-446655440000';
const USER_ID = '550e8400-e29b-71d4-a716-446655440000';
const REPORT_ID = '990e8400-e29b-71d4-a716-446655440000';

const AUTHOR = {
  id: USER_ID,
  username: 'alice_wonder',
  displayName: 'Alice Wonder',
  avatarUrl: 'https://example.com/avatars/alice.png',
};

const NEXT_CURSOR_BASE64 =
  'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAyVDEwOjQ1OjAwLjAwMFoiLCJpZCI6Ijg4MGU4NDAwLWUyOWItNzFkNC1hNzE2LTQ0NjY1NTQ0MDAwMDEifQ';

// ─── GET /quizzes/:quizId/comments ────────────────────────────────────────────

export const QUIZ_COMMENTS_LIST_EXAMPLE = {
  data: [
    {
      id: COMMENT_ID_A,
      quizId: QUIZ_ID,
      authorId: USER_ID,
      author: AUTHOR,
      parentCommentId: null,
      body: 'Great question — I learned a lot from this quiz.',
      isHidden: false,
      hiddenById: null,
      hiddenAt: null,
      votesCount: 5,
      upvotesCount: 6,
      downvotesCount: 1,
      repliesCount: 2,
      createdAt: '2026-06-02T10:35:00.000Z',
      updatedAt: '2026-06-02T10:45:00.000Z',
      deletedAt: null,
      userVote: null,
      replies: [
        {
          id: COMMENT_ID_B,
          quizId: QUIZ_ID,
          authorId: USER_ID,
          author: AUTHOR,
          parentCommentId: COMMENT_ID_A,
          body: 'Glad it helped!',
          isHidden: false,
          hiddenById: null,
          hiddenAt: null,
          votesCount: 1,
          upvotesCount: 1,
          downvotesCount: 0,
          repliesCount: 0,
          createdAt: '2026-06-02T10:40:00.000Z',
          updatedAt: '2026-06-02T10:40:00.000Z',
          deletedAt: null,
        },
      ],
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor: NEXT_CURSOR_BASE64,
    },
  },
} as const;

export const QUIZ_COMMENTS_EMPTY_EXAMPLE = {
  data: [],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;

// ─── POST /quizzes/:quizId/comments ───────────────────────────────────────────

export const COMMENT_CREATED_EXAMPLE = {
  data: {
    id: COMMENT_ID_A,
    quizId: QUIZ_ID,
    authorId: USER_ID,
    author: AUTHOR,
    parentCommentId: null,
    body: 'Great question — I learned a lot from this quiz.',
    isHidden: false,
    hiddenById: null,
    hiddenAt: null,
    votesCount: 0,
    upvotesCount: 0,
    downvotesCount: 0,
    repliesCount: 0,
    createdAt: EXAMPLE_TIMESTAMP,
    updatedAt: EXAMPLE_TIMESTAMP,
    deletedAt: null,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const REPLY_CREATED_EXAMPLE = {
  data: {
    id: COMMENT_ID_B,
    quizId: QUIZ_ID,
    authorId: USER_ID,
    author: AUTHOR,
    parentCommentId: COMMENT_ID_A,
    body: 'Glad it helped!',
    isHidden: false,
    hiddenById: null,
    hiddenAt: null,
    votesCount: 0,
    upvotesCount: 0,
    downvotesCount: 0,
    repliesCount: 0,
    createdAt: EXAMPLE_TIMESTAMP,
    updatedAt: EXAMPLE_TIMESTAMP,
    deletedAt: null,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /comments/:commentId ─────────────────────────────────────────────────

export const COMMENT_DETAIL_EXAMPLE = {
  data: {
    id: COMMENT_ID_A,
    quizId: QUIZ_ID,
    authorId: USER_ID,
    author: AUTHOR,
    parentCommentId: null,
    body: 'Great question — I learned a lot from this quiz.',
    isHidden: false,
    hiddenById: null,
    hiddenAt: null,
    votesCount: 5,
    upvotesCount: 6,
    downvotesCount: 1,
    repliesCount: 2,
    createdAt: '2026-06-02T10:35:00.000Z',
    updatedAt: '2026-06-02T10:45:00.000Z',
    deletedAt: null,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── PATCH /comments/:commentId ───────────────────────────────────────────────

export const COMMENT_UPDATED_EXAMPLE = {
  data: {
    id: COMMENT_ID_A,
    quizId: QUIZ_ID,
    authorId: USER_ID,
    author: AUTHOR,
    parentCommentId: null,
    body: 'Updated wording after a clearer second read.',
    isHidden: false,
    hiddenById: null,
    hiddenAt: null,
    votesCount: 5,
    upvotesCount: 6,
    downvotesCount: 1,
    repliesCount: 2,
    createdAt: '2026-06-02T10:35:00.000Z',
    updatedAt: EXAMPLE_TIMESTAMP,
    deletedAt: null,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /comments/:commentId/reports ───────────────────────────────────────

export const COMMENT_REPORT_CREATED_EXAMPLE = {
  data: {
    reportId: REPORT_ID,
    reporterId: USER_ID,
    commentId: COMMENT_ID_A,
    reason: 'spam',
    details: 'Repeated promotional links.',
    status: 'open',
    reviewedByUserId: null,
    reviewedAt: null,
    actionTaken: false,
    createdAt: EXAMPLE_TIMESTAMP,
    updatedAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /comments/reports/:reportId/review ────────────────────────────────

export const COMMENT_REPORT_REVIEWED_EXAMPLE = {
  data: {
    reportId: REPORT_ID,
    reporterId: USER_ID,
    commentId: COMMENT_ID_A,
    reason: 'spam',
    details: 'Repeated promotional links.',
    status: 'actioned',
    reviewedByUserId: USER_ID,
    reviewedAt: EXAMPLE_TIMESTAMP,
    actionTaken: true,
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /comments/reports ───────────────────────────────────────────────────

export const COMMENT_REPORTS_LIST_EXAMPLE = {
  data: [
    {
      reportId: REPORT_ID,
      reporterId: USER_ID,
      commentId: COMMENT_ID_A,
      reason: 'spam',
      details: 'Repeated promotional links.',
      status: 'open',
      reviewedByUserId: null,
      reviewedAt: null,
      actionTaken: false,
      createdAt: '2026-07-26T08:00:00.000Z',
      updatedAt: '2026-07-26T08:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;

// ─── GET /users/me/comments ──────────────────────────────────────────────────

export const MY_COMMENTS_LIST_EXAMPLE = {
  data: [
    {
      id: COMMENT_ID_A,
      quizId: QUIZ_ID,
      quizTitle: 'Closures and Scope',
      body: 'Great question — I learned a lot from this quiz.',
      votesCount: 5,
      repliesCount: 2,
      createdAt: '2026-06-02T10:35:00.000Z',
      updatedAt: '2026-06-02T10:45:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor: NEXT_CURSOR_BASE64,
    },
  },
} as const;

// ─── GET /users/:userId/comments ─────────────────────────────────────────────

export const USER_COMMENTS_LIST_EXAMPLE = {
  data: [
    {
      id: COMMENT_ID_A,
      quizId: QUIZ_ID,
      quizTitle: 'Closures and Scope',
      body: 'Great question — I learned a lot from this quiz.',
      votesCount: 5,
      repliesCount: 2,
      createdAt: '2026-06-02T10:35:00.000Z',
      updatedAt: '2026-06-02T10:45:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;
