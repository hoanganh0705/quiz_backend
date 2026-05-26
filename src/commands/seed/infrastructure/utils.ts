import * as bcrypt from 'bcrypt';

export const trimText = (value: string): string => value.trim();

export const normalizeEmail = (value: string): string => trimText(value).toLowerCase();

export const normalizeUsername = (value: string): string => trimText(value).toLowerCase();

export const normalizeSlug = (value: string): string => {
  const slug = trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new Error('Invalid slug: cannot be empty after normalization');
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Invalid slug format: ${slug}`);
  }

  return slug;
};

export const assertUniqueBy = <T>(
  items: readonly T[],
  keyFn: (item: T) => string,
  label: string,
): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      throw new Error(`Duplicate ${label} in seed payload: ${key}`);
    }
    seen.add(key);
  }
};

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);

export const formatSummary = (domain: string, inserted: number, updated: number, skipped: number): string =>
  `${domain}: inserted=${inserted}, updated=${updated}, skipped=${skipped}`;

export type NormalizedUserSeed = {
  email: string;
  username: string;
  password: string;
  role: 'admin' | 'moderator' | 'user';
  displayName: string;
  bio: string;
  avatarUrl: string;
  settings: Record<string, unknown>;
};

export const normalizeUserSeeds = (input: readonly {
  email: string;
  username: string;
  password: string;
  role: 'admin' | 'moderator' | 'user';
  displayName: string;
  bio: string;
  avatarUrl: string;
  settings?: Record<string, unknown>;
}[]): NormalizedUserSeed[] =>
  input.map((seed) => ({
    email: normalizeEmail(seed.email),
    username: normalizeUsername(seed.username),
    password: seed.password,
    role: seed.role,
    displayName: trimText(seed.displayName),
    bio: trimText(seed.bio),
    avatarUrl: trimText(seed.avatarUrl),
    settings: seed.settings ?? {},
  }));

export type NormalizedCategorySeed = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
};

export const normalizeCategorySeeds = (
  input: readonly {
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
  }[],
): NormalizedCategorySeed[] =>
  input.map((seed) => ({
    name: trimText(seed.name),
    slug: normalizeSlug(seed.slug || seed.name),
    description: trimText(seed.description),
    imageUrl: trimText(seed.imageUrl),
  }));

export type NormalizedTagSeed = {
  name: string;
  slug: string;
};

export const normalizeTagSeeds = (
  input: readonly {
    name: string;
    slug: string;
  }[],
): NormalizedTagSeed[] =>
  input.map((seed) => ({
    name: trimText(seed.name),
    slug: normalizeSlug(seed.slug || seed.name),
  }));
