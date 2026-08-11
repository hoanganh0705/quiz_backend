import {
  DEFAULT_LOCALE,
  LevelTitle,
  localiseLevelTitle,
  negotiateLocale,
  resolveLevelTitleLabel,
} from './level.types';

/**
 * Phase 6 (Accept-Language): pure-function unit tests for the
 * locale negotiator and the level-title localiser. The locale
 * machinery is exported as standalone functions so the helpers
 * can be tested without a DB / module / Nest boot.
 */
describe('negotiateLocale', () => {
  it('returns the default locale when the header is empty', () => {
    expect(negotiateLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('returns the default locale when the header is malformed', () => {
    expect(negotiateLocale(',,;')).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('   ')).toBe(DEFAULT_LOCALE);
  });

  it('matches the primary subtag of a supported locale', () => {
    expect(negotiateLocale('en')).toBe('en');
    expect(negotiateLocale('vi')).toBe('vi');
    expect(negotiateLocale('en-US')).toBe('en');
    expect(negotiateLocale('vi-VN')).toBe('vi');
  });

  it('falls back to the default when nothing matches', () => {
    expect(negotiateLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('de-DE')).toBe(DEFAULT_LOCALE);
  });

  it('honours quality factors and picks the highest ranked match', () => {
    expect(negotiateLocale('fr;q=0.9, vi;q=0.5')).toBe('vi');
    expect(negotiateLocale('fr;q=0.5, en;q=0.9')).toBe('en');
  });

  it('skips entries with q=0', () => {
    expect(negotiateLocale('fr;q=0, en;q=1')).toBe('en');
    expect(negotiateLocale('fr;q=0, vi;q=0')).toBe(DEFAULT_LOCALE);
  });

  it('uses the first occurrence on a tie (sorted by q then insertion order)', () => {
    // Both have q=1.0; the first listed is preferred.
    expect(negotiateLocale('en, vi')).toBe('en');
  });
});

describe('localiseLevelTitle', () => {
  it('returns the English label for the default locale', () => {
    expect(localiseLevelTitle(LevelTitle.Specialist, 'en')).toBe('Specialist');
    expect(localiseLevelTitle(LevelTitle.Novice, 'en')).toBe('Novice');
  });

  it('returns the Vietnamese label for the `vi` locale', () => {
    expect(localiseLevelTitle(LevelTitle.Specialist, 'vi')).toBe('Chuyên gia');
    expect(localiseLevelTitle(LevelTitle.Novice, 'vi')).toBe('Tân thủ');
    expect(localiseLevelTitle(LevelTitle.Legend, 'vi')).toBe('Huyền thoại');
  });

  it('falls back to the English label for unknown locales', () => {
    expect(localiseLevelTitle(LevelTitle.Novice, 'fr' as never)).toBe('Novice');
  });

  it('covers every level title in every supported locale', () => {
    for (const locale of ['en', 'vi'] as const) {
      for (const title of Object.values(LevelTitle)) {
        const label = localiseLevelTitle(title, locale);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('resolveLevelTitleLabel', () => {
  it('combines negotiation + lookup', () => {
    expect(resolveLevelTitleLabel(LevelTitle.Grandmaster, 'vi')).toBe('Đại sư phụ');
    expect(resolveLevelTitleLabel(LevelTitle.Grandmaster, 'en')).toBe('Grandmaster');
    expect(resolveLevelTitleLabel(LevelTitle.Grandmaster, 'ja')).toBe('Grandmaster');
    expect(resolveLevelTitleLabel(LevelTitle.Grandmaster, undefined)).toBe('Grandmaster');
  });
});
