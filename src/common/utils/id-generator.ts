import { Injectable, Module } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * UUID v7 generator.
 *
 * Format (RFC 9562 §5.7):
 *   - 48 bits: unix milliseconds (big-endian)
 *   -  4 bits: version (0b0111)
 *   - 12 bits: rand_a (random)
 *   -  2 bits: variant (0b10)
 *   - 62 bits: rand_b (random)
 *
 * The DB schema defaults every primary-key column to `uuidv7()` (Postgres
 * extension `pg_uuidv7`). To keep app-generated IDs byte-for-byte aligned
 * with DB-generated ones, app code MUST also produce v7 — never v4 (which
 * is what `crypto.randomUUID()` returns).
 *
 * Two surfaces are exposed:
 *   - `IdGenerator` (Nest provider) — preferred; injectable everywhere via
 *     the global `ID_GENERATOR` token.
 *   - `generateUuidV7()` (plain function) — escape hatch for cases where a
 *     Nest provider cannot be used (e.g. inside a one-shot command script).
 *
 * Both call into the same `uuidV7Bytes()` helper so behaviour stays
 * identical and the format is testable in isolation.
 */
export const uuidV7Bytes = (): Buffer => {
  const bytes = randomBytes(16);
  const millis = BigInt(Date.now());

  // Layout bytes 0–5 (48 bits): unix milliseconds, big-endian.
  bytes[0] = Number((millis >> 40n) & 0xffn);
  bytes[1] = Number((millis >> 32n) & 0xffn);
  bytes[2] = Number((millis >> 24n) & 0xffn);
  bytes[3] = Number((millis >> 16n) & 0xffn);
  bytes[4] = Number((millis >> 8n) & 0xffn);
  bytes[5] = Number(millis & 0xffn);

  // High nibble of byte 6 = version (0b0111).
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // High two bits of byte 8 = variant (0b10).
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytes;
};

/**
 * RFC 9562 v7 string in canonical hyphenated form (8-4-4-4-12).
 * Lowercase to match Postgres `uuidv7()` output (`8-4-4-4-12` lowercase).
 */
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Stricter UUIDv7 check that enforces the version-7 nibble AND the
 * RFC 4122 / RFC 9562 variant bits (`8`, `9`, `a`, `b`). Use this
 * when the caller is parsing a UUID that was *produced* by the
 * project — every UUID surfaced over the wire is UUIDv7, so a v4 /
 * unknown-version UUID is a sign of tampering or stale data.
 *
 * `isUuidV7()` above is more permissive (canonical hyphenated form
 * only, no version/variant check) because it is used at write-time
 * when generating IDs locally. `isUuidV7Strict()` is the read-side
 * counterpart for cursor parsers and other untrusted inputs.
 */
const UUID_V7_STRICT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const generateUuidV7 = (): string => {
  const bytes = uuidV7Bytes();
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const isUuidV7 = (value: unknown): value is string =>
  typeof value === 'string' && UUID_V7_PATTERN.test(value);

export const isUuidV7Strict = (value: unknown): value is string =>
  typeof value === 'string' && UUID_V7_STRICT_PATTERN.test(value);

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export interface IdGeneratorPort {
  generate(): string;
}

@Injectable()
export class IdGenerator implements IdGeneratorPort {
  generate(): string {
    return generateUuidV7();
  }
}

/**
 * Internal module that re-exports the IdGenerator provider so it can be
 * imported by the global CommonModule. Kept separate so the generator
 * stays self-contained and is trivially mockable in unit tests.
 */
@Module({
  providers: [IdGenerator, { provide: ID_GENERATOR, useExisting: IdGenerator }],
  exports: [IdGenerator, ID_GENERATOR],
})
export class IdGeneratorModule {}
