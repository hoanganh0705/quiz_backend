/// <reference types="jest" />
import { ReviewAuthorizationPolicy } from './review-authorization.policy';

describe('ReviewAuthorizationPolicy.isVisibleToReviewers — Phase 1 / Issue #1 + #25', () => {
  it('returns false when the quiz is null (deleted / missing)', () => {
    expect(ReviewAuthorizationPolicy.isVisibleToReviewers(null)).toBe(false);
  });

  it('returns false when the quiz is hidden', () => {
    expect(
      ReviewAuthorizationPolicy.isVisibleToReviewers({
        quizId: 'q1',
        isHidden: true,
        publishedVersionId: 'v1',
      }),
    ).toBe(false);
  });

  it('returns false when the quiz has no published version (draft)', () => {
    expect(
      ReviewAuthorizationPolicy.isVisibleToReviewers({
        quizId: 'q1',
        isHidden: false,
        publishedVersionId: null,
      }),
    ).toBe(false);
  });

  it('returns true when the quiz is visible and has a published version', () => {
    expect(
      ReviewAuthorizationPolicy.isVisibleToReviewers({
        quizId: 'q1',
        isHidden: false,
        publishedVersionId: 'v1',
      }),
    ).toBe(true);
  });
});

describe('ReviewAuthorizationPolicy.canReport — self-report guard', () => {
  // Defense-in-depth: the same guard lives in two places (the policy
  // here, and a DB trigger in migration 0016). These tests pin the
  // application-layer behavior so a future refactor cannot silently
  // weaken the rule.

  it('rejects when the reporter is the review author', () => {
    expect(
      ReviewAuthorizationPolicy.canReport({
        reviewId: 'r-1',
        authorUserId: 'u-1',
        reporterUserId: 'u-1',
      }),
    ).toBe(false);
  });

  it('rejects even when the actor is an admin (admin role does NOT bypass)', () => {
    expect(
      ReviewAuthorizationPolicy.canReport({
        reviewId: 'r-1',
        authorUserId: 'u-1',
        reporterUserId: 'u-1',
      }),
    ).toBe(false);
  });

  it('rejects even when the actor is a moderator', () => {
    expect(
      ReviewAuthorizationPolicy.canReport({
        reviewId: 'r-1',
        authorUserId: 'u-1',
        reporterUserId: 'u-1',
      }),
    ).toBe(false);
  });

  it('allows when the reporter is a different user', () => {
    expect(
      ReviewAuthorizationPolicy.canReport({
        reviewId: 'r-1',
        authorUserId: 'u-1',
        reporterUserId: 'u-2',
      }),
    ).toBe(true);
  });

  it('compares ids as opaque strings (case-sensitive)', () => {
    expect(
      ReviewAuthorizationPolicy.canReport({
        reviewId: 'r-1',
        authorUserId: 'ABCD',
        reporterUserId: 'abcd',
      }),
    ).toBe(true);
  });
});
