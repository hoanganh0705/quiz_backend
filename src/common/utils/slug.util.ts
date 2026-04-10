import { BadRequestException } from '@nestjs/common';

export const DEFAULT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const buildSlug = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizeSlugOrThrow = (
  input: string,
  options?: {
    pattern?: RegExp;
    emptyMessage?: string;
    invalidMessage?: string;
  },
): string => {
  const slug = input.trim().toLowerCase();

  if (!slug) {
    throw new BadRequestException(options?.emptyMessage ?? 'Slug cannot be empty');
  }

  const pattern = options?.pattern ?? DEFAULT_SLUG_PATTERN;

  if (!pattern.test(slug)) {
    throw new BadRequestException(
      options?.invalidMessage ??
        'Slug must be lowercase and can only contain letters, numbers, and hyphens',
    );
  }

  return slug;
};
