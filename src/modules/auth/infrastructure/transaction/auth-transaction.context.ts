import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthTransactionContext {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();

  run<T>(callback: () => Promise<T>): Promise<T> {
    return this.storage.run(new Map<string, unknown>(), callback);
  }

  get<T>(key: string): T | undefined {
    return this.storage.getStore()?.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.storage.getStore()?.set(key, value);
  }
}
