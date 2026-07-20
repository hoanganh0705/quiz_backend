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
