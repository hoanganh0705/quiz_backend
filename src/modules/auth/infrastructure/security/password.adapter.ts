import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PasswordProvider } from '../../domain/ports/password.provider';

const DUMMY_PASSWORD = 'unused-placeholder-for-timing-attack-mitigation';

@Injectable()
export class PasswordAdapter implements PasswordProvider {
  private static readonly BCRYPT_ROUNDS = 12;
  private dummyHashCache: { value: string } | null = null;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, PasswordAdapter.BCRYPT_ROUNDS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  getDummyHash(): string {
    if (this.dummyHashCache === null) {
      const generated = bcrypt.hashSync(DUMMY_PASSWORD, PasswordAdapter.BCRYPT_ROUNDS);
      this.dummyHashCache = { value: generated };
    }
    return this.dummyHashCache.value;
  }
}
