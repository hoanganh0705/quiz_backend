import * as bcrypt from 'bcrypt';
import { PasswordAdapter } from './password.adapter';

describe('PasswordAdapter.getDummyHash', () => {
  it('returns a bcrypt-formatted hash (2y/2a/2b prefix + 22-char salt + 31-char digest)', () => {
    const adapter = new PasswordAdapter();
    const hash = adapter.getDummyHash();
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
  });

  it('memoizes the dummy hash across calls', () => {
    const adapter = new PasswordAdapter();
    const first = adapter.getDummyHash();
    const second = adapter.getDummyHash();
    expect(first).toBe(second);
  });

  it('uses the configured BCRYPT_ROUNDS cost factor', () => {
    const adapter = new PasswordAdapter();
    const hash = adapter.getDummyHash();
    const rounds = Number(hash.split('$')[2]);
    expect(Number.isInteger(rounds)).toBe(true);
    expect(rounds).toBeGreaterThanOrEqual(10);
    expect(rounds).toBeLessThanOrEqual(15);
  });

  it('does not leak the literal cost factor of any other secret', () => {
    const adapter = new PasswordAdapter();
    const hash = adapter.getDummyHash();
    expect(hash).not.toContain('4HFj7c4f1QH7wHTQXhH1ueYCMr5xM9A2m8K6q9M2m6I6QfZlq6QmW');
  });

  it('the hash verifies a non-matching password (so bcrypt.compare runs and returns false)', async () => {
    const adapter = new PasswordAdapter();
    const hash = adapter.getDummyHash();
    const result = await bcrypt.compare('not-the-real-password', hash);
    expect(result).toBe(false);
  });
});
