import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class CryptoService {
  hashSha256(value: string): string {
    // create a SHA-256 hash with the value and return it as a hexadecimal string. This is a common way to securely hash sensitive data like passwords or tokens before storing them in a database, ensuring that the original value cannot be easily retrieved even if the database is compromised.
    return createHash('sha256').update(value).digest('hex');
  }
}
