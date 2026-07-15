/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TagRankingQueryDto } from './tag-ranking-query.dto';

/**
 * Phase 2 of `docs/api-contract-audit-tag.md` — the `limit` field on
 * `TagRankingQueryDto` is missing `@IsOptional()`. Without it, the OpenAPI
 * spec marks `limit` as optional (with a default of 10), but the
 * runtime validation contract is inconsistent: `class-validator` evaluates
 * the `@IsInt` / `@Min` / `@Max` decorators unconditionally even when the
 * value is absent.
 *
 * In practice the class-default `limit: number = 10` still applies when the
 * query string omits `limit`, so the request succeeds — but the validator
 * does NOT produce a clean zero-error response when the field is missing.
 * This spec locks the new contract so:
 *
 *   - missing `limit` → no validation errors (uses the class default of 10)
 *   - integer within [1, 100] → no validation errors
 *   - out-of-range or non-integer values → produce validation errors
 *
 * Drives the validator through `class-transformer` + `class-validator`
 * the same way NestJS does at request time.
 */
describe('TagRankingQueryDto — limit validation (Phase 2)', () => {
  const runValidate = async (input: Record<string, unknown>) => {
    const instance = plainToInstance(TagRankingQueryDto, input);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    return errors;
  };

  const limitErrors = (errors: Awaited<ReturnType<typeof runValidate>>) =>
    errors.filter((e) => e.property === 'limit');

  describe('passes', () => {
    it('accepts missing limit (uses class default of 10)', async () => {
      const errors = await runValidate({});
      expect(limitErrors(errors)).toEqual([]);
      expect(errors).toEqual([]);
    });

    it.each([['lower bound', 1], ['middle', 50], ['upper bound', 100]])(
      'accepts limit=%s (%i)',
      async (_label, value) => {
        const errors = await runValidate({ limit: value });
        expect(limitErrors(errors)).toEqual([]);
      },
    );

    it('accepts explicit undefined', async () => {
      const errors = await runValidate({ limit: undefined });
      expect(limitErrors(errors)).toEqual([]);
    });
  });

  describe('fails', () => {
    it('rejects limit below 1', async () => {
      const errors = await runValidate({ limit: 0 });
      expect(limitErrors(errors).length).toBeGreaterThan(0);
    });

    it('rejects negative limit', async () => {
      const errors = await runValidate({ limit: -5 });
      expect(limitErrors(errors).length).toBeGreaterThan(0);
    });

    it('rejects limit above 100', async () => {
      const errors = await runValidate({ limit: 101 });
      expect(limitErrors(errors).length).toBeGreaterThan(0);
    });

    it('rejects non-integer limit', async () => {
      const errors = await runValidate({ limit: 3.14 });
      expect(limitErrors(errors).length).toBeGreaterThan(0);
    });

    it('rejects string limit (would be coerced by class-transformer but not in all pipes)', async () => {
      // When @Type(() => Number) is applied, "10" would coerce to 10 and pass.
      // An un-coercible string should still fail.
      const errors = await runValidate({ limit: 'not-a-number' });
      // Either the int validator fails, or the min/max fails — the key invariant
      // is that this is rejected.
      expect(limitErrors(errors).length).toBeGreaterThan(0);
    });
  });
});