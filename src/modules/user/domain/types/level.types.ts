/**
 * Phase 1 (S-5): level-progression domain types.
 *
 * `LevelService` (S-2) is responsible for projecting an XP total to a
 * level, a current/next XP bracket, and a human-readable title.
 * The thresholds table lives here so the mapper, the service, and the
 * Swagger examples all reference the same source of truth.
 *
 * Title progression is a deliberate hand-set of qualitative phases —
 * `XP_PER_LEVEL` is linear (500xp/level) but the title bands are not.
 * The current bands map to:
 *
 *   1 →  4   Novice
 *   5 →  9   Apprentice
 *  10 → 19   Competitor
 *  20 → 34   Specialist
 *  35 → 49   Expert
 *  50 → 74   Master
 *  75 → 99   Grandmaster
 * 100+       Legend
 *
 * `1` is a floor: any user with `xpTotal = 0` already sits at level 1
 * (the existing `calculateLevel` helper in `domain/user.service.ts`
 * uses `floor(xp / XP_PER_LEVEL) + 1`).
 */

export enum LevelTitle {
  Novice = 'novice',
  Apprentice = 'apprentice',
  Competitor = 'competitor',
  Specialist = 'specialist',
  Expert = 'expert',
  Master = 'master',
  Grandmaster = 'grandmaster',
  Legend = 'legend',
}

/**
 * Phase 6 (Accept-Language): locale-aware level-title labels.
 *
 * The `levelTitle` field on `UserSummaryResponseDto` stays a machine-
 * readable enum (`LevelTitle`) so clients can switch on it. The
 * `levelTitleLocalised` field is the human-readable label resolved
 * from the `Accept-Language` header — the controller negotiates the
 * supported language and falls back to `'en'` when the request
 * language is unknown or the header is missing.
 *
 * The set is intentionally small for now (English + Vietnamese);
 * adding a new language is a one-row addition here plus a key in
 * `SUPPORTED_LOCALES`.
 */
const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

const LEVEL_TITLE_LOCALES: Readonly<Record<SupportedLocale, Readonly<Record<LevelTitle, string>>>> = {
  en: {
    [LevelTitle.Novice]: 'Novice',
    [LevelTitle.Apprentice]: 'Apprentice',
    [LevelTitle.Competitor]: 'Competitor',
    [LevelTitle.Specialist]: 'Specialist',
    [LevelTitle.Expert]: 'Expert',
    [LevelTitle.Master]: 'Master',
    [LevelTitle.Grandmaster]: 'Grandmaster',
    [LevelTitle.Legend]: 'Legend',
  },
  vi: {
    [LevelTitle.Novice]: 'Tân thủ',
    [LevelTitle.Apprentice]: 'Học việc',
    [LevelTitle.Competitor]: 'Đối thủ',
    [LevelTitle.Specialist]: 'Chuyên gia',
    [LevelTitle.Expert]: 'Cao thủ',
    [LevelTitle.Master]: 'Bậc thầy',
    [LevelTitle.Grandmaster]: 'Đại sư phụ',
    [LevelTitle.Legend]: 'Huyền thoại',
  },
};

/**
 * Negotiation rules:
 *   1. Empty / undefined / malformed → `DEFAULT_LOCALE`.
 *   2. Pick the first requested language that matches a supported
 *      locale on the primary subtag (`xx` or `xx-YY` form).
 *   3. If nothing matches, fall back to `DEFAULT_LOCALE`.
 *
 * Quality factors (`q=`) are honoured: tags with `q=0` are skipped.
 */
export function negotiateLocale(acceptLanguage: string | undefined | null): SupportedLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const tags = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      let q = 1;
      for (const param of params) {
        const [key, value] = param.trim().split('=');
        if (key === 'q' && value !== undefined) {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) q = parsed;
        }
      }
      return { tag: tag.toLowerCase(), q };
    })
    .filter((entry) => entry.tag.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const primary = tag.split('-')[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
      return primary as SupportedLocale;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Resolve a `LevelTitle` to its localized label for the given locale.
 * Unknown locales fall back to `DEFAULT_LOCALE`. Always returns a
 * non-empty string so consumers can render unconditionally.
 */
export function localiseLevelTitle(title: LevelTitle, locale: SupportedLocale): string {
  const table = LEVEL_TITLE_LOCALES[locale] ?? LEVEL_TITLE_LOCALES[DEFAULT_LOCALE];
  return table[title] ?? title;
}

/**
 * One-shot helper that combines negotiation + lookup. The controller
 * passes the raw `Accept-Language` header value and receives a
 * ready-to-render string.
 */
export function resolveLevelTitleLabel(
  title: LevelTitle,
  acceptLanguage: string | undefined | null,
): string {
  return localiseLevelTitle(title, negotiateLocale(acceptLanguage));
}

interface LevelBand {
  /** Inclusive lower bound on the user's level (1-indexed). */
  minLevel: number;
  /** Inclusive upper bound on the user's level (use `Infinity` for "no upper bound"). */
  maxLevel: number;
  title: LevelTitle;
}

const LEVEL_BANDS: readonly LevelBand[] = [
  { minLevel: 1, maxLevel: 4, title: LevelTitle.Novice },
  { minLevel: 5, maxLevel: 9, title: LevelTitle.Apprentice },
  { minLevel: 10, maxLevel: 19, title: LevelTitle.Competitor },
  { minLevel: 20, maxLevel: 34, title: LevelTitle.Specialist },
  { minLevel: 35, maxLevel: 49, title: LevelTitle.Expert },
  { minLevel: 50, maxLevel: 74, title: LevelTitle.Master },
  { minLevel: 75, maxLevel: 99, title: LevelTitle.Grandmaster },
  { minLevel: 100, maxLevel: Number.POSITIVE_INFINITY, title: LevelTitle.Legend },
];

/** Default XP cost per level — matches `user.domain-constants.ts`. */
export const LEVEL_XP_PER_LEVEL = 500;

export interface LevelProjection {
  /** 1-indexed level (`calculateLevel(xpTotal)`). */
  level: number;
  /** XP required to enter `level` (i.e. lower bound). */
  currentLevelXP: number;
  /** XP required to enter the next level (exclusive ceiling). */
  nextLevelXP: number;
  /** How far through the current level the user is, in `0..100`. */
  xpProgressPercent: number;
  /** Qualitative band corresponding to `level`. */
  levelTitle: LevelTitle;
}

/**
 * Resolve the user's level / bracket / progress / title from a single
 * XP total. Pure / side-effect free so the service layer can call it
 * synchronously and unit tests can hammer it without setting up a DB.
 */
export function projectLevel(xpTotal: number): LevelProjection {
  const safeXp = Math.max(0, Math.floor(xpTotal));
  const level = Math.floor(safeXp / LEVEL_XP_PER_LEVEL) + 1;
  const currentLevelXP = (level - 1) * LEVEL_XP_PER_LEVEL;
  const nextLevelXP = level * LEVEL_XP_PER_LEVEL;

  // Per-band progress: clamp to [0, 99.99] so a user exactly at the
  // cap reads as "one-shot away from levelling up" rather than "100%
  // ready", which would be a confusing off-by-one for the level-up
  // animation client-side.
  const progressRaw =
    nextLevelXP === currentLevelXP
      ? 0
      : Math.round(((safeXp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 1000) / 10;
  const xpProgressPercent = Math.max(0, Math.min(99.9, progressRaw));

  const band = LEVEL_BANDS.find((b) => level >= b.minLevel && level <= b.maxLevel);
  const levelTitle = band?.title ?? LevelTitle.Legend;

  return {
    level,
    currentLevelXP,
    nextLevelXP,
    xpProgressPercent,
    levelTitle,
  };
}
