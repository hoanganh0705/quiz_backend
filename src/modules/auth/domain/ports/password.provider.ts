export interface PasswordProvider {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  getDummyHash(): string;
}

export const PASSWORD_PROVIDER = Symbol('PASSWORD_PROVIDER');
