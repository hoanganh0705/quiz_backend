/**
 * Cloudinary `public_id` shape validation.
 *
 * Server-generated public_ids follow a strict shape — see migration
 * plan §4 / §11:
 *
 *   ${CLOUDINARY_FOLDER}/${purposeFolder}/${ownerId}/${uuidv7()}
 *
 * with the document defaults being `quiz-app/{avatars|quizzes}/<uuid>/<uuid>`.
 * Validating the shape at the DTO boundary is a defence-in-depth
 * measure: the authoritative ownership check (the `storage_assets`
 * row) is done in `StorageApplicationService.userOwnsAssetForPurpose`,
 * but a malformed id never reaches that gate — it is rejected with
 * 400 `ASSET_PUBLIC_ID_INVALID` first.
 *
 * The regex is intentionally narrow:
 *   - lowercase folder names
 *   - uuidv7() output (hex + '-' only)
 *   - no user-supplied bytes anywhere in the path
 *
 * Two regexes are exported: one for the strict document shape
 * (`STORAGE_PUBLIC_ID_PATTERN`) and one that matches the trailing
 * `${ownerId}/${uuidv7()}` portion only (`STORAGE_PUBLIC_ID_TAIL_PATTERN`),
 * used as a `@Matches` decorator on the wire DTOs where the folder
 * prefix is opaque to the caller.
 */

const UUID_V7_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

/**
 * The full `public_id` shape used by this codebase:
 *
 *   quiz-app/(avatars|quizzes)/<uuidv7>/<uuidv7>
 *
 * The first uuidv7 is `ownerId`; the second is the per-asset random
 * component. Both are server-generated so the format is fixed.
 */
export const STORAGE_PUBLIC_ID_PATTERN = new RegExp(
  `^quiz-app/(avatars|quizzes)/(${UUID_V7_PATTERN})/(${UUID_V7_PATTERN})$`,
);

/**
 * The tail of the public_id (after the folder prefix). Used by DTO
 * validators that don't want to lock the folder name into the wire
 * contract.
 */
export const STORAGE_PUBLIC_ID_TAIL_PATTERN = new RegExp(
  `^(${UUID_V7_PATTERN})/(${UUID_V7_PATTERN})$`,
);

export const STORAGE_PUBLIC_ID_INVALID_MESSAGE =
  'publicId must match the Cloudinary-assigned shape: quiz-app/<purpose>/<uuidv7>/<uuidv7>';
