/**
 * The upload policy table — per-purpose folder, MIME allowlist, byte
 * cap, and Cloudinary transformation.
 *
 * The single source of truth for "what does a valid <purpose> upload
 * look like". Read by:
 *
 *   - the concrete adapters in `core/storage/infrastructure/{cloudinary,fake}/`
 *     (folder selection, derived-URL transformations)
 *   - the upload controller in Phase 3 (`modules/upload/`) — for the
 *     per-purpose size cap and MIME allowlist *before* the file hits
 *     the adapter
 *   - the upload application service for the final policy check
 *
 * Moved out of `storage.types.ts` so that domain modules can import
 * the constant without dragging the full `StoragePort` interface along.
 */

import type { UploadPurpose } from '../storage.types';

export interface UploadPolicy {
  /** Cloudinary folder for this purpose (e.g. "quiz-app/avatars"). */
  readonly folder: string;
  /** Hard byte cap. Surfaces as 400 UPLOAD_FILE_TOO_LARGE in Phase 3. */
  readonly maxBytes: number;
  /** Allowlisted MIME types. Surfaces as 400 UPLOAD_UNSUPPORTED_MEDIA_TYPE. */
  readonly allowedMime: ReadonlySet<string>;
  /**
   * Cloudinary transformation applied when deriving a URL.
   * Passed verbatim to `cloudinary.url(publicId, { transformation })`.
   */
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
