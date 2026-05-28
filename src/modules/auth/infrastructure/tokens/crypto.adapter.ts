import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { CryptoProvider } from '../../domain/ports/crypto.provider';

@Injectable()
export class CryptoAdapter implements CryptoProvider {
  hashSha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
