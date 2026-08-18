/**
 * Storage port contract — types.
 *
 * Module-private definition of the `StoragePort` interface that the rest of
 * the application talks to. Concrete implementations live in
 * `core/storage/infrastructure/{cloudinary,fake}/` and must satisfy this
 * interface.
 *
 * The per-purpose upload policy lives in `core/storage/domain/upload-policy.ts`
 * so that domain modules can import it without dragging the `StoragePort`
 * interface along.
 */

export type UploadPurpose = 'avatar' | 'quiz';

export interface UploadInput {
  /** Raw image bytes (memory-storage buffer from Multer). */
  readonly buffer: Buffer;
  /** MIME type, e.g. "image/png". Validated against policy.allowedMime. */
  readonly mime: string;
  /** Byte length of `buffer`. Validated against policy.maxBytes. */
  readonly bytes: number;
  /** Which logical purpose this upload serves. */
  readonly purpose: UploadPurpose;
  /**
   * The authenticated caller's UUID (from `currentUser.sub`).
   * Embedded by the adapter into `public_id` as a structural defence in
   * depth (ownership is still decided by the `storage_assets` row, not
   * by string parsing here).
   */
  readonly ownerId: string;
}

export interface UploadResult {
  /**
   * The Cloudinary `public_id`. Server-generated as
   * `${folder}/${ownerId}/${uuidv7()}`; the client treats this as opaque
   * and echoes it back when patching the entity.
   */
  readonly publicId: string;
  /** A URL the client may use for immediate render (preview, optimistic UI). */
  readonly url: string;
  /** Actual byte count reported by the storage provider. */
  readonly bytes: number;
  /** Reported format, e.g. "webp". */
  readonly format: string;
  /** Reported width in pixels. */
  readonly width: number;
  /** Reported height in pixels. */
  readonly height: number;
}

/**
 * The Port. Domain modules inject `STORAGE_PORT` and call these three
 * methods. They do not import any concrete adapter.
 */
export interface StoragePort {
  upload(input: UploadInput): Promise<UploadResult>;
  /**
   * Idempotent delete. An absent `publicId` is treated as success.
   */
  delete(publicId: string): Promise<void>;
  /**
   * Re-derive a stable, public URL from a `publicId` for read paths.
   * Pure function — no I/O.
   */
  deriveUrl(publicId: string, purpose: UploadPurpose): string;
}
