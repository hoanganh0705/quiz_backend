import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { CryptoProvider } from '../../domain/ports/crypto.provider';

@Injectable()
export class CryptoAdapter implements CryptoProvider {
  private static readonly BCRYPT_ROUNDS = 12;

  hashSha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async hashBcrypt(value: string): Promise<string> {
    return bcrypt.hash(value, CryptoAdapter.BCRYPT_ROUNDS);
  }
}
