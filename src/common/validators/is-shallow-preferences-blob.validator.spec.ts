/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate, IsObject, IsOptional } from 'class-validator';
import { IsShallowPreferencesBlob } from './is-shallow-preferences-blob.validator';

class Holder {
  @IsOptional()
  @IsObject()
  @IsShallowPreferencesBlob()
  preferences?: Record<string, unknown>;
}

const run = async (input: Record<string, unknown>) => {
  const dto = plainToInstance(Holder, input);
  const errors = await validate(dto);
  return errors.filter((e) => e.property === 'preferences');
};

describe('IsShallowPreferencesBlob (F-14)', () => {
  describe('passes', () => {
    it.each([
      ['empty object', {}],
      ['flat primitives', { theme: 'dark', notifications: true, count: 5, empty: null }],
      ['one level deep', { a: { b: true } }],
      ['two levels deep', { a: { b: { c: true } } }],
      ['three levels deep (max allowed)', { a: { b: { c: 'leaf' } } }],
      ['arrays', { list: [1, 2, 3] }],
      ['arrays-of-objects', { list: [{ a: 1 }] }],
      ['long string at boundary', { key: 'x'.repeat(1000) }],
    ])('accepts %s', async (_label, preferences) => {
      const errors = await run({ preferences });
      expect(errors).toEqual([]);
    });

    it('accepts null (treated as absent by the application layer)', async () => {
      const errors = await run({ preferences: null });
      expect(errors).toEqual([]);
    });

    it('accepts undefined (treated as absent)', async () => {
      const errors = await run({});
      expect(errors).toEqual([]);
    });
  });

  describe('fails — depth', () => {
    it('rejects objects nested 4 levels deep (the limit is 3 nested keys)', async () => {
      const preferences = { a: { b: { c: { d: 1 } } } };
      const errors = await run({ preferences });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects objects nested 5 levels deep', async () => {
      const preferences = { a: { b: { c: { d: { e: 1 } } } } };
      const errors = await run({ preferences });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('fails — string length', () => {
    it('rejects string values longer than 1000 characters', async () => {
      const preferences = { key: 'x'.repeat(1001) };
      const errors = await run({ preferences });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('fails — binary blob', () => {
    it('rejects Buffer instances', async () => {
      const preferences = { key: Buffer.from([1, 2, 3]) };
      const errors = await run({ preferences });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects serialized Buffer payloads ({ type: "Buffer", data: [...] })', async () => {
      const preferences = {
        key: { type: 'Buffer', data: [1, 2, 3] },
      };
      const errors = await run({ preferences });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('fails — wrong type', () => {
    it.each([
      ['string', 'oops'],
      ['number', 42],
      ['array', [1, 2]],
    ])('rejects %s as the top-level preferences value', async (_label, value) => {
      const errors = await run({ preferences: value });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
