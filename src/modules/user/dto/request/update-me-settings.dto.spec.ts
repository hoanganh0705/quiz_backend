/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeSettingsDto } from './update-me-settings.dto';

/**
 * Phase 3.3 of `docs/migrations/USER_MODULE_CONTRACT_HARDENING.md` — the
 * `preferences` field on `UpdateMeSettingsDto` is bounded to:
 *   - max 50 top-level keys (`@MaxKeys(50)`)
 *   - each key string capped at 200 characters (`@MaxKeyStringLength(200)`)
 *
 * Phase 3 (F-6, `docs/audits/USER_MODULE_PRODUCTION_READINESS_AUDIT.md`)
 * renamed `settings` → `preferences` and added a `privacy` sub-object
 * for the granular privacy flags now persisted to `user_profile_settings`.
 *
 * This spec locks both contracts so:
 *   - valid payloads (≤50 keys, ≤200-char keys, boolean privacy flags) pass,
 *   - over-keyed objects, over-length keys, and non-objects fail.
 *
 * The test drives the validator through `class-transformer` + `class-validator`
 * the same way NestJS does at request time.
 */
describe('UpdateMeSettingsDto — settings bounds (Phase 3.3 + F-6)', () => {
  const runValidate = async (input: Record<string, unknown>) => {
    const instance = plainToInstance(UpdateMeSettingsDto, input);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    return errors;
  };

  const preferencesErrors = (errors: Awaited<ReturnType<typeof runValidate>>) =>
    errors.filter((e) => e.property === 'preferences');

  describe('preferences — passes', () => {
    it('accepts an empty object', async () => {
      const errors = await runValidate({ preferences: {} });
      expect(preferencesErrors(errors)).toEqual([]);
    });

    it('accepts a single key-value pair', async () => {
      const errors = await runValidate({ preferences: { theme: 'dark' } });
      expect(preferencesErrors(errors)).toEqual([]);
    });

    it('accepts primitive values of all types', async () => {
      const errors = await runValidate({
        preferences: {
          string: 'hello',
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          object: { nested: true },
        },
      });
      expect(preferencesErrors(errors)).toEqual([]);
    });

    it('accepts exactly 50 keys', async () => {
      const preferences: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) preferences[`key_${i}`] = i;
      const errors = await runValidate({ preferences });
      expect(preferencesErrors(errors)).toEqual([]);
    });

    it('accepts a key string of exactly 200 characters', async () => {
      const key = 'a'.repeat(200);
      const errors = await runValidate({ preferences: { [key]: 'value' } });
      expect(preferencesErrors(errors)).toEqual([]);
    });
  });

  describe('preferences — fails — too many keys', () => {
    it('rejects 51 keys', async () => {
      const preferences: Record<string, unknown> = {};
      for (let i = 0; i < 51; i++) preferences[`key_${i}`] = i;
      const errors = await runValidate({ preferences });
      const sErrs = preferencesErrors(errors);
      expect(sErrs.length).toBeGreaterThan(0);
    });
  });

  describe('preferences — fails — key length', () => {
    it('rejects a key string of 201 characters', async () => {
      const key = 'a'.repeat(201);
      const errors = await runValidate({ preferences: { [key]: 'value' } });
      const sErrs = preferencesErrors(errors);
      expect(sErrs.length).toBeGreaterThan(0);
    });
  });

  describe('preferences — fails — not an object', () => {
    it.each([
      ['string', 'not-an-object'],
      ['number', 42],
      ['boolean', false],
    ])('rejects %s as preferences value', async (_label, value) => {
      const errors = await runValidate({
        preferences: value,
      } as unknown as Record<string, unknown>);
      expect(preferencesErrors(errors).length).toBeGreaterThan(0);
    });

    // Note: `null` is intentionally accepted (treated as "absent" by the
    // application layer) so the application never persists an explicit
    // null in the preferences blob.
    it('accepts null as preferences (treated as absent)', async () => {
      const errors = await runValidate({
        preferences: null,
      } as unknown as Record<string, unknown>);
      expect(preferencesErrors(errors)).toEqual([]);
    });
  });

  describe('privacy — passes', () => {
    it('accepts a fully-populated privacy object', async () => {
      const errors = await runValidate({
        privacy: {
          isPublic: true,
          showStatistics: true,
          showAchievements: false,
          showActivity: true,
          showRankImprovement: true,
          showTournamentActivity: true,
        },
      });
      expect(errors).toEqual([]);
    });

    it('accepts a partial privacy object (only one flag)', async () => {
      const errors = await runValidate({ privacy: { showActivity: false } });
      expect(errors).toEqual([]);
    });
  });

  describe('privacy — fails — non-boolean flag', () => {
    it.each([
      ['string', 'yes'],
      ['number', 1],
    ])('rejects %s as privacy flag value', async (_label, value) => {
      const errors = await runValidate({
        privacy: { showActivity: value },
      } as unknown as Record<string, unknown>);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Note: `null` is intentionally accepted (treated as "absent" by the
    // application layer) so the application never persists an explicit
    // null into the privacy flags.
    it('accepts null as privacy flag value (treated as absent)', async () => {
      const errors = await runValidate({
        privacy: { showActivity: null },
      } as unknown as Record<string, unknown>);
      expect(errors).toEqual([]);
    });
  });
});
