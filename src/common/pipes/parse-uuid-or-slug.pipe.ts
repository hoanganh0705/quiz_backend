import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Pipe that accepts either a UUID or a kebab-case slug and rejects anything
 * that looks like neither.
 *
 * The pipe is intentionally permissive: it does not enforce the version
 * nibble of UUIDs (ParseUUIDPipe({ version: '4' }) is too strict and breaks
 * real UUIDs in the seed data that use other versions). Anything that is not
 * a UUID must look like a valid kebab-case slug, otherwise the request is
 * rejected with a 400 (which the global exception filter turns into a
 * ProblemDetail).
 */
@Injectable()
export class ParseUUIDOrSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (UUID_RE.test(value)) {
      return value;
    }
    if (SLUG_RE.test(value)) {
      return value;
    }
    throw new BadRequestException('Path param must be a UUID or a kebab-case slug');
  }
}

/**
 * Plain helper used by controllers to dispatch on a path param. Kept here so
 * the regex definition lives in a single place.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
