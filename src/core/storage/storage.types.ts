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
 * Phase 7 #1 — presigned upload result.
 *
 * Returned by `StoragePort.createSignedUpload(...)`. The client uploads
 * the file directly to `uploadUrl` (a Cloudinary endpoint) using a
 * `multipart/form-data` POST with the `file`, `api_key`, `timestamp`,
 * `signature`, and `public_id` fields. The server does not proxy the
 * bytes.
 */
export interface SignedUpload {
  /** The URL the client should POST the file to (Cloudinary upload endpoint). */
  readonly uploadUrl: string;
  /**
   * The Cloudinary `public_id` that the upload will be stored under.
   * The client passes this in the multipart form, and the client
   * later echoes it back when patching the entity.
   */
  readonly publicId: string;
  /** ISO 8601 timestamp at which this signature will no longer be accepted. */
  readonly expiresAt: string;
  /**
   * The Cloudinary `api_key` the client must include alongside the
   * upload (paired with the `signature` and `timestamp` form fields).
   */
  readonly apiKey: string;
  /** Signature value the client must include in the form data. */
  readonly signature: string;
  /** Unix timestamp the client must include in the form data. */
  readonly timestamp: number;
  /** Echo of the per-purpose folder for client debugging. */
  readonly folder: string;
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
  /**
   * Phase 2 #3 — health probe. The Cloudinary adapter calls
   * `cloudinary.api.ping()`; the fake adapter resolves. The health
   * endpoint uses this to surface per-dependency status.
   */
  ping(): Promise<void>;
  /**
   * Phase 7 #1 — generate a Cloudinary signed-upload URL that a
   * client can POST a file to *directly*, without proxying the
   * bytes through the application server. Implementations MUST
   * produce a Cloudinary-accepted signature and a public_id that
   * obeys the same `${folder}/${ownerId}/${uuid}` shape used by
   * `upload(...)`. The signed URL must expire; implementations
   * MUST respect `expiresInSeconds`.
   */
  createSignedUpload(input: {
    readonly ownerId: string;
    readonly purpose: UploadPurpose;
    readonly expiresInSeconds: number;
  }): Promise<SignedUpload>;
}
