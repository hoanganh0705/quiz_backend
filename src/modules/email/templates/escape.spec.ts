import { escapeHtml, escapeHtmlAttr, formatTtlDescription } from './escape';

describe('escape', () => {
  describe('escapeHtml', () => {
    it('escapes the five HTML-significant characters', () => {
      expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
        '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
      );
    });

    it('returns an empty string unchanged', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('passes through strings without HTML-significant characters', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('escapeHtmlAttr', () => {
    it('is equivalent to escapeHtml', () => {
      expect(escapeHtmlAttr('<x>')).toBe(escapeHtml('<x>'));
    });
  });

  describe('formatTtlDescription', () => {
    it('formats sub-minute TTLs in seconds', () => {
      expect(formatTtlDescription(1)).toBe('1 second');
      expect(formatTtlDescription(59)).toBe('59 seconds');
    });

    it('formats sub-hour TTLs in minutes', () => {
      expect(formatTtlDescription(60)).toBe('1 minute');
      expect(formatTtlDescription(120)).toBe('2 minutes');
      expect(formatTtlDescription(3_000)).toBe('50 minutes');
    });

    it('formats sub-day TTLs in hours', () => {
      expect(formatTtlDescription(3_600)).toBe('1 hour');
      expect(formatTtlDescription(7_200)).toBe('2 hours');
      expect(formatTtlDescription(86_300)).toBe('24 hours');
    });

    it('formats TTLs of one day or more in days', () => {
      expect(formatTtlDescription(86_400)).toBe('1 day');
      expect(formatTtlDescription(86_400 * 2)).toBe('2 days');
    });
  });
});
