import { Inject, Injectable } from '@nestjs/common';
import { TRACING_PROVIDER, type TracingProvider } from '@/core/observability/tracing.provider';

const TRACED_METHODS = ['select', 'insert', 'update', 'delete', 'execute', 'transaction'] as const;
type TracedMethod = (typeof TRACED_METHODS)[number];

@Injectable()
export class DrizzleTracingWrapper {
  constructor(
    @Inject(TRACING_PROVIDER)
    private readonly tracing: TracingProvider,
  ) {}

  wrap<T extends object>(client: T): T {
    return new Proxy(client, {
      get: (target, prop, receiver) => {
        if (typeof prop !== 'string' || !TRACED_METHODS.includes(prop as TracedMethod)) {
          return Reflect.get(target, prop, receiver);
        }
        const original = Reflect.get(target, prop, receiver) as unknown;
        if (typeof original !== 'function') return original;
        return (...args: unknown[]) => {
          return this.tracing.withSpan(
            `db.${prop}`,
            {
              kind: 'client',
              attributes: {
                'db.system': 'postgresql',
                'db.operation': String(prop),
              },
            },
            () => Reflect.apply(original, target, args),
          );
        };
      },
    });
  }
}
