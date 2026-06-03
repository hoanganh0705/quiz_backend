export interface CryptoProvider {
  hashSha256(value: string): string;
  hashBcrypt(value: string): Promise<string>;
}

export const CRYPTO_PROVIDER = Symbol('CRYPTO_PROVIDER');
