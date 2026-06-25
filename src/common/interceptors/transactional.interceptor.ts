import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { TransactionalContext } from './transactional-context';

export const TRANSACTIONAL_KEY = Symbol('TRANSACTIONAL_KEY');

/**
 * Marks a handler as transactional — the `TransactionalInterceptor` will wrap the
 * entire request in a database transaction, stored in `TransactionalContext` so
 * any nested repository call can opt-in to reuse the same transaction client
 * instead of opening a new one (preventing duplicate transactions / savepoints).
 *
 * Usage on controller methods:
 * ```
 * @Transactional()
 * @Post()
 * create(...) { ... }
 * ```
 */
export function Transactional(): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(TRANSACTIONAL_KEY, true, descriptor.value!);
    return descriptor;
  };
}

/**
 * Global interceptor that:
 *   - Skips non-transactional handlers entirely (zero overhead).
 *   - Wraps transactional handlers in `TransactionalContext.run()` so any
 *     repository/service in the call chain can access the shared context.
 *
 * Handlers decorated with `@Transactional()` are still responsible for opening
 * the actual DB transaction via `db.transaction()`. The interceptor only
 * provides the async storage scope — repositories check `getDbClient()` to
 * decide whether to open a new transaction or reuse an existing one.
 */
@Injectable()
export class TransactionalInterceptor implements NestInterceptor {
  constructor(private readonly transactionalContext: TransactionalContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    if (Reflect.getMetadata(TRANSACTIONAL_KEY, handler) !== true) {
      return next.handle();
    }

    return defer(() => this.transactionalContext.run(() => next.handle()));
  }
}
