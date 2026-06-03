export interface CryptoProvider {
  hashSha256(value: string): string;
}

export const CRYPTO_PROVIDER = Symbol('CRYPTO_PROVIDER');
