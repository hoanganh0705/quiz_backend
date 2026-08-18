/**
 * Snapshot test for the upload policy table.
 *
 * The `UPLOAD_POLICY` constant is the single source of truth for per-
 * purpose limits. Cloudinary transformations, MIME allowlists, and
 * byte caps are read by the upload application service, the upload
 * controller's `ParseFilePipe`, and the concrete adapters. Any drift
 * between layers surfaces here as a snapshot diff.
 */
import { UPLOAD_POLICY } from './upload-policy';

describe('UPLOAD_POLICY', () => {
  it('avatar: 512x512 fill, 5 MB cap, JPEG/PNG/WEBP/GIF', () => {
    expect(UPLOAD_POLICY.avatar).toMatchObject({
      folder: 'quiz-app/avatars',
      maxBytes: 5 * 1024 * 1024,
    });
    expect(Array.from(UPLOAD_POLICY.avatar.allowedMime).sort()).toEqual([
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(UPLOAD_POLICY.avatar.transformation).toEqual([
      {
        width: 512,
        height: 512,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      },
    ]);
  });

  it('quiz: 1600x900 fill, 8 MB cap, JPEG/PNG/WEBP (no GIF)', () => {
    expect(UPLOAD_POLICY.quiz).toMatchObject({
      folder: 'quiz-app/quizzes',
      maxBytes: 8 * 1024 * 1024,
    });
    expect(Array.from(UPLOAD_POLICY.quiz.allowedMime).sort()).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(UPLOAD_POLICY.quiz.transformation).toEqual([
      {
        width: 1_600,
        height: 900,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      },
    ]);
  });

  it('SVG is excluded from both purposes (XSS risk)', () => {
    expect(UPLOAD_POLICY.avatar.allowedMime.has('image/svg+xml')).toBe(false);
    expect(UPLOAD_POLICY.quiz.allowedMime.has('image/svg+xml')).toBe(false);
  });

  it('every purpose uses `fill` + `auto` gravity + `auto` quality + `auto` format', () => {
    for (const purpose of Object.values(UPLOAD_POLICY)) {
      expect(purpose.transformation[0]).toMatchObject({
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      });
    }
  });
});