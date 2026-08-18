/**
 * Unit tests for the `STORAGE_PUBLIC_ID_TAIL_PATTERN` validator.
 *
 * The validator's only job is to fail loud at the DTO boundary for
 * `avatarPublicId` / `imagePublicId`. The authoritative ownership
 * check is the `storage_assets` row, but the regex catches the
 * obvious forgery / typo cases before they reach the DB.
 */

import {
  STORAGE_PUBLIC_ID_PATTERN,
  STORAGE_PUBLIC_ID_TAIL_PATTERN,
} from './storage-public-id.util';

describe('STORAGE_PUBLIC_ID_TAIL_PATTERN', () => {
  const valid = [
    // ownerId + per-asset uuidv7 (uuidv7 has the '7' in the version nibble).
    '0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a',
  ];

  const invalid = [
    '',
    'not-a-uuid',
    '0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b', // missing the trailing uuidv7
    '0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0d8e3a45-7d7a-11f0-9e2a-9b0d9e2c7f3b', // uuidv1 not v7
    '0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/extra',
    '0D8E3A45-7D7A-71F0-9E2A-9B0D9E2C7F3B/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a', // uppercase
  ];

  valid.forEach((input) => {
    it(`accepts ${input}`, () => {
      expect(STORAGE_PUBLIC_ID_TAIL_PATTERN.test(input)).toBe(true);
    });
  });

  invalid.forEach((input) => {
    it(`rejects "${input}"`, () => {
      expect(STORAGE_PUBLIC_ID_TAIL_PATTERN.test(input)).toBe(false);
    });
  });
});

describe('STORAGE_PUBLIC_ID_PATTERN', () => {
  it('matches a well-formed full publicId', () => {
    const full =
      'quiz-app/avatars/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a';
    expect(STORAGE_PUBLIC_ID_PATTERN.test(full)).toBe(true);
  });

  it('matches a quiz purpose folder', () => {
    const full =
      'quiz-app/quizzes/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a';
    expect(STORAGE_PUBLIC_ID_PATTERN.test(full)).toBe(true);
  });

  it('rejects an unknown purpose folder', () => {
    const full =
      'quiz-app/banners/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a';
    expect(STORAGE_PUBLIC_ID_PATTERN.test(full)).toBe(false);
  });
});
