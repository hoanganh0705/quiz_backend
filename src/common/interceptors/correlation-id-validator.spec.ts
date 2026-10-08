import {
  isValidCorrelationId,
  sanitizeCorrelationId,
  CORRELATION_ID_HEADER,
  CORRELATION_ID_MAX_LENGTH,
} from './correlation-id-validator';

describe('correlation-id-validator', () => {
  describe('isValidCorrelationId', () => {
    it.each(['abc', 'ABC', 'abc-123', '1234567890', 'a', 'A'.repeat(CORRELATION_ID_MAX_LENGTH)])(
      'accepts %s',
      (value) => {
        expect(isValidCorrelationId(value)).toBe(true);
      },
    );

    it.each([
      ['', 'empty'],
      [null, 'null'],
      [undefined, 'undefined'],
      [123, 'number'],
      [{}, 'object'],
      ['abc.def', 'dot'],
      ['abc_def', 'underscore'],
      ['abc def', 'space'],
      ['abc/def', 'slash'],
      ['abc;def', 'semicolon'],
      ['abc\ndef', 'newline'],
      ['abc\rdef', 'carriage return'],
      ['abc"def', 'quote'],
      ["abc'def", 'apostrophe'],
      ['абц', 'non-ascii cyrillic'],
      ['abc😀', 'emoji'],
      ['A'.repeat(CORRELATION_ID_MAX_LENGTH + 1), 'too long'],
    ])('rejects %s (%s)', (value, _label) => {
      expect(isValidCorrelationId(value as unknown)).toBe(false);
    });
  });

  describe('sanitizeCorrelationId', () => {
    it('returns the raw value when valid', () => {
      expect(sanitizeCorrelationId('valid-id-123')).toBe('valid-id-123');
    });

    it('falls back to a UUID when the value is missing or invalid', () => {
      expect(sanitizeCorrelationId(undefined)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(sanitizeCorrelationId('contains space')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(sanitizeCorrelationId('')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('uses a custom fallback when provided', () => {
      expect(sanitizeCorrelationId(undefined, () => 'fallback')).toBe('fallback');
      expect(sanitizeCorrelationId('has space', () => 'fallback')).toBe('fallback');
    });
  });

  it('exports the header constant', () => {
    expect(CORRELATION_ID_HEADER).toBe('x-correlation-id');
  });
});
