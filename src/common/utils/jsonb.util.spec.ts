import { assertJsonbSize, jsonbByteSize, JsonbPayloadTooLargeError } from './jsonb.util';

describe('jsonb.util', () => {
  describe('jsonbByteSize', () => {
    it('returns the UTF-8 byte size of a simple object', () => {
      const size = jsonbByteSize({ a: 1 });
      expect(size).toBe(Buffer.byteLength(JSON.stringify({ a: 1 })));
    });

    it('counts multi-byte characters correctly', () => {
      const payload = { msg: 'éèê' };
      const expected = Buffer.byteLength(JSON.stringify(payload));
      expect(jsonbByteSize(payload)).toBe(expected);
    });

    it('handles empty objects', () => {
      expect(jsonbByteSize({})).toBe(2);
    });

    it('handles nested structures', () => {
      const payload = { outer: { inner: [1, 2, 3] } };
      expect(jsonbByteSize(payload)).toBe(Buffer.byteLength(JSON.stringify(payload)));
    });
  });

  describe('assertJsonbSize', () => {
    it('returns void when payload is within limit', () => {
      const payload = { a: 1 };
      expect(() => assertJsonbSize(payload, 1024)).not.toThrow();
    });

    it('throws JsonbPayloadTooLargeError when payload exceeds limit', () => {
      const payload = { hello: 'world' };
      const byteSize = jsonbByteSize(payload);
      try {
        assertJsonbSize(payload, byteSize - 1);
        fail('Expected JsonbPayloadTooLargeError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonbPayloadTooLargeError);
        expect((error as JsonbPayloadTooLargeError).code).toBe('JSONB_PAYLOAD_TOO_LARGE');
        expect((error as JsonbPayloadTooLargeError).actualBytes).toBe(byteSize);
        expect((error as JsonbPayloadTooLargeError).maxBytes).toBe(byteSize - 1);
      }
    });

    it('accepts a payload exactly at the limit', () => {
      const payload = { exact: true };
      const byteSize = jsonbByteSize(payload);
      expect(() => assertJsonbSize(payload, byteSize)).not.toThrow();
    });
  });

  describe('JsonbPayloadTooLargeError', () => {
    it('exposes a code property for error matching', () => {
      const error = new JsonbPayloadTooLargeError(100, 50);
      expect(error.code).toBe('JSONB_PAYLOAD_TOO_LARGE');
      expect(error.actualBytes).toBe(100);
      expect(error.maxBytes).toBe(50);
      expect(error.message).toContain('100');
      expect(error.message).toContain('50');
    });

    it('is throwable as a normal Error', () => {
      expect(() => {
        throw new JsonbPayloadTooLargeError(10, 5);
      }).toThrow(JsonbPayloadTooLargeError);
    });
  });
});
