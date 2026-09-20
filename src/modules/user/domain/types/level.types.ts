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

const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

const LEVEL_TITLE_LOCALES: Readonly<Record<SupportedLocale, Readonly<Record<LevelTitle, string>>>> =
  {
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

export function localiseLevelTitle(title: LevelTitle, locale: SupportedLocale): string {
  const table = LEVEL_TITLE_LOCALES[locale] ?? LEVEL_TITLE_LOCALES[DEFAULT_LOCALE];
  return table[title] ?? title;
}

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

export function projectLevel(xpTotal: number): LevelProjection {
  const safeXp = Math.max(0, Math.floor(xpTotal));
  const level = Math.floor(safeXp / LEVEL_XP_PER_LEVEL) + 1;
  const currentLevelXP = (level - 1) * LEVEL_XP_PER_LEVEL;
  const nextLevelXP = level * LEVEL_XP_PER_LEVEL;
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
