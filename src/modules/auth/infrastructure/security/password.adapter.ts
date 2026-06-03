import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PasswordProvider } from '../../domain/ports/password.provider';

@Injectable()
export class PasswordAdapter implements PasswordProvider {
  private static readonly BCRYPT_ROUNDS = 12;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, PasswordAdapter.BCRYPT_ROUNDS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  getDummyHash(): string {
    return '$2b$12$4HFj7c4f1QH7wHTQXhH1ueYCMr5xM9A2m8K6q9M2m6I6QfZlq6QmW';
  }
}
