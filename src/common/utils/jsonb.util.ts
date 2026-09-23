/**
 * Thrown when a JSONB payload exceeds the configured maximum byte size.
 */
export class JsonbPayloadTooLargeError extends Error {
  readonly code = 'JSONB_PAYLOAD_TOO_LARGE';
  constructor(
    readonly actualBytes: number,
    readonly maxBytes: number,
  ) {
    super(`JSONB payload size ${actualBytes} bytes exceeds limit of ${maxBytes} bytes`);
  }
}

/**
 * Returns the byte size of a value when serialized as JSON.
 * Uses `TextEncoder` so multi-byte characters are counted correctly.
 */
export function jsonbByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Asserts that a JSONB payload does not exceed the given byte limit.
 * Throws `JsonbPayloadTooLargeError` if the limit is exceeded.
 *
 * @param payload  - The JSONB-safe value to validate.
 * @param maxBytes - Maximum allowed serialized byte size.
 *
 * Usage:
 *   assertJsonbSize(eventPayload, 64 * 1024);  // 64 KiB
 *   assertJsonbSize(attemptPayload, 1 * 1024 * 1024); // 1 MiB
 */
export function assertJsonbSize(payload: Record<string, unknown>, maxBytes: number): void {
  const actual = jsonbByteSize(payload);
  if (actual > maxBytes) {
    throw new JsonbPayloadTooLargeError(actual, maxBytes);
  }
}
