/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeSettingsDto } from './update-me-settings.dto';

/**
 * Phase 3.3 of `docs/migrations/USER_MODULE_CONTRACT_HARDENING.md` — the
 * `settings` field on `UpdateMeSettingsDto` is bounded to:
 *   - max 50 top-level keys (`@MaxKeys(50)`)
 *   - each key string capped at 200 characters (`@MaxKeyStringLength(200)`)
 *
 * This spec locks the new contracts so:
 *   - valid payloads (≤50 keys, ≤200-char keys) pass,
 *   - over-keyed objects, over-length keys, and non-objects fail.
 *
 * The test drives the validator through `class-transformer` + `class-validator`
 * the same way NestJS does at request time.
 */
describe('UpdateMeSettingsDto — settings bounds (Phase 3.3)', () => {
  const runValidate = async (input: Record<string, unknown>) => {
    const instance = plainToInstance(UpdateMeSettingsDto, input);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    return errors;
  };

  const settingsErrors = (errors: Awaited<ReturnType<typeof runValidate>>) =>
    errors.filter((e) => e.property === 'settings');

  describe('passes', () => {
    it('accepts empty object', async () => {
      const errors = await runValidate({ settings: {} });
      expect(settingsErrors(errors)).toEqual([]);
    });

    it('accepts a single key-value pair', async () => {
      const errors = await runValidate({ settings: { theme: 'dark' } });
      expect(settingsErrors(errors)).toEqual([]);
    });

    it('accepts primitive values of all types', async () => {
      const errors = await runValidate({
        settings: {
          string: 'hello',
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          object: { nested: true },
        },
      });
      expect(settingsErrors(errors)).toEqual([]);
    });

    it('accepts exactly 50 keys', async () => {
      const settings: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) settings[`key_${i}`] = i;
      const errors = await runValidate({ settings });
      expect(settingsErrors(errors)).toEqual([]);
    });

    it('accepts a key string of exactly 200 characters', async () => {
      const key = 'a'.repeat(200);
      const errors = await runValidate({ settings: { [key]: 'value' } });
      expect(settingsErrors(errors)).toEqual([]);
    });
  });

  describe('fails — too many keys', () => {
    it('rejects 51 keys', async () => {
      const settings: Record<string, unknown> = {};
      for (let i = 0; i < 51; i++) settings[`key_${i}`] = i;
      const errors = await runValidate({ settings });
      const sErrs = settingsErrors(errors);
      expect(sErrs.length).toBeGreaterThan(0);
    });
  });

  describe('fails — key length', () => {
    it('rejects a key string of 201 characters', async () => {
      const key = 'a'.repeat(201);
      const errors = await runValidate({ settings: { [key]: 'value' } });
      const sErrs = settingsErrors(errors);
      expect(sErrs.length).toBeGreaterThan(0);
    });
  });

  describe('fails — not an object', () => {
    it.each([
      ['string', 'not-an-object'],
      ['number', 42],
      ['boolean', false],
      ['null', null],
    ])('rejects %s as settings value', async (_label, value) => {
      const errors = await runValidate({ settings: value } as unknown as Record<string, unknown>);
      expect(settingsErrors(errors).length).toBeGreaterThan(0);
    });
  });
});
