/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeDto } from './update-me.dto';

/**
 * Phase 1.3 of `docs/migrations/USER_MODULE_CONTRACT_HARDENING.md` — the
 * `avatarUrl` field on `UpdateMeDto` is tightened from
 * `@IsUrl({ require_tld: false })` to
 * `@IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true })`.
 *
 * This spec locks the new contract so:
 *   - well-formed HTTP(S) URLs pass,
 *   - bare strings, FTP, mailto, missing protocol, empty host, and overlong
 *     payloads fail.
 *
 * The test drives the validator through `class-transformer` + `class-validator`
 * the same way NestJS does at request time, so the assertions reflect what the
 * runtime ValidationPipe will actually return.
 */
describe('UpdateMeDto — avatarUrl validation (Phase 1.3)', () => {
  const runValidate = async (input: Record<string, unknown>) => {
    const instance = plainToInstance(UpdateMeDto, input);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    return errors;
  };

  const avatarErrors = (errors: Awaited<ReturnType<typeof runValidate>>) =>
    errors.filter((e) => e.property === 'avatarUrl');

  describe('passes', () => {
    it.each([
      ['https URL with TLD', 'https://example.com/avatars/alice.jpg'],
      ['https URL with path and query', 'https://cdn.example.com/u/alice?v=2&x=1'],
      ['https URL with port', 'https://example.com:8443/avatars/alice.png'],
      ['https with subdomain', 'https://avatars.example.com/u/1'],
    ])('accepts %s', async (_label, value) => {
      const errors = await runValidate({ avatarUrl: value });
      expect(avatarErrors(errors)).toEqual([]);
    });

    it('accepts null (clears the avatar)', async () => {
      const errors = await runValidate({ avatarUrl: null });
      expect(avatarErrors(errors)).toEqual([]);
    });

    it('accepts blank string after Trim (clears the avatar)', async () => {
      const errors = await runValidate({ avatarUrl: '   ' });
      expect(avatarErrors(errors)).toEqual([]);
    });

    it('accepts undefined (no-op)', async () => {
      const errors = await runValidate({});
      expect(avatarErrors(errors)).toEqual([]);
    });
  });

  describe('fails', () => {
    it.each([
      ['bare string', 'not-a-url'],
      ['plain word with dot', 'foo.bar'],
      ['ftp scheme', 'ftp://files.example.com/x.png'],
      ['mailto scheme', 'mailto:foo@bar.com'],
      ['javascript scheme', 'javascript:alert(1)'],
      ['protocol-relative URL', '//example.com/x.png'],
      ['missing protocol', 'example.com/avatars/alice.jpg'],
      ['empty host', 'https://'],
      ['ftp scheme (another variant)', 'ftp://example.com/avatar.png'],
      ['file scheme', 'file:///path/to/file.png'],
    ])('rejects %s', async (_label, value) => {
      const errors = await runValidate({ avatarUrl: value });
      expect(avatarErrors(errors).length).toBeGreaterThan(0);
    });

    it('rejects a 2049-character URL', async () => {
      const huge = `https://example.com/${'a'.repeat(2030)}.jpg`;
      expect(huge.length).toBeGreaterThan(2048);
      const errors = await runValidate({ avatarUrl: huge });
      expect(avatarErrors(errors).length).toBeGreaterThan(0);
    });
  });

  describe('field isolation', () => {
    it('still validates other fields independently of avatarUrl', async () => {
      const errors = await runValidate({ displayName: 'a'.repeat(101) });
      const displayNameErrors = errors.filter((e) => e.property === 'displayName');
      expect(displayNameErrors.length).toBeGreaterThan(0);
    });
  });
});
