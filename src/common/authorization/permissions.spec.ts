/// <reference types="jest" />
import { hasPermission, Permission } from './permissions';

describe('Permission / Role-Permission mapping — Phase 5 / Issue #29', () => {
  describe('REVIEW_MODERATE', () => {
    it('is granted to admin', () => {
      expect(hasPermission('admin', Permission.REVIEW_MODERATE)).toBe(true);
    });

    it('is granted to moderator', () => {
      expect(hasPermission('moderator', Permission.REVIEW_MODERATE)).toBe(true);
    });

    it('is NOT granted to a regular user', () => {
      expect(hasPermission('user', Permission.REVIEW_MODERATE)).toBe(false);
    });
  });

  describe('REVIEW_VIEW_QUIZ_ANALYTICS (Issue #21)', () => {
    it('is granted to admin', () => {
      expect(hasPermission('admin', Permission.REVIEW_VIEW_QUIZ_ANALYTICS)).toBe(true);
    });

    it('is granted to moderator', () => {
      expect(hasPermission('moderator', Permission.REVIEW_VIEW_QUIZ_ANALYTICS)).toBe(true);
    });

    it('is NOT granted to a regular user', () => {
      expect(hasPermission('user', Permission.REVIEW_VIEW_QUIZ_ANALYTICS)).toBe(false);
    });
  });
});
