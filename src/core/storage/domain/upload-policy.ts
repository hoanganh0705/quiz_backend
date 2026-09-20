import type { UploadPurpose } from '../storage.types';

export interface UploadPolicy {
  readonly folder: string;
  readonly maxBytes: number;
  readonly allowedMime: ReadonlySet<string>;
  readonly transformation: ReadonlyArray<Record<string, unknown>>;
}

export const UPLOAD_POLICY: Record<UploadPurpose, UploadPolicy> = {
  avatar: {
    folder: 'quiz-app/avatars',
    maxBytes: 5 * 1024 * 1024,
    allowedMime: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    transformation: [
      {
        width: 512,
        height: 512,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      },
    ],
  },
  quiz: {
    folder: 'quiz-app/quizzes',
    maxBytes: 8 * 1024 * 1024,
    allowedMime: new Set(['image/jpeg', 'image/png', 'image/webp']),
    transformation: [
      {
        width: 1_600,
        height: 900,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      },
    ],
  },
};
