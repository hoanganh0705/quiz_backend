/**
 * Compile-time sanity check for `storage.types.ts` and `UPLOAD_POLICY`.
 *
 * `UPLOAD_POLICY` is read by every consumer (adapters, DTO validator in
 * Phase 3, the lifecycle service in Phase 6). This spec is intentionally
 * minimal — it pins the shape and asserts the documented constants stay
 * stable across refactors.
 */

import { UPLOAD_POLICY } from './domain/upload-policy';

describe('UPLOAD_POLICY', () => {
  it('declares avatar and quiz entries', () => {
    expect(Object.keys(UPLOAD_POLICY).sort()).toEqual(['avatar', 'quiz']);
  });

  it('uses the documented Cloudinary folders', () => {
    expect(UPLOAD_POLICY.avatar.folder).toBe('quiz-app/avatars');
    expect(UPLOAD_POLICY.quiz.folder).toBe('quiz-app/quizzes');
  });

  it('caps avatar at 5 MiB and quiz at 8 MiB', () => {
    expect(UPLOAD_POLICY.avatar.maxBytes).toBe(5 * 1024 * 1024);
    expect(UPLOAD_POLICY.quiz.maxBytes).toBe(8 * 1024 * 1024);
  });

  it('allowlists the documented MIME types', () => {
    expect(Array.from(UPLOAD_POLICY.avatar.allowedMime).sort()).toEqual(
      ['image/gif', 'image/jpeg', 'image/png', 'image/webp'].sort(),
    );
    expect(Array.from(UPLOAD_POLICY.quiz.allowedMime).sort()).toEqual(
      ['image/jpeg', 'image/png', 'image/webp'].sort(),
    );
  });
});
