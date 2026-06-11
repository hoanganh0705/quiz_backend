import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { AUTH_TRANSACTIONAL_KEY } from './transactional.decorator';
import { AuthTransactionContext } from './auth-transaction.context';

@Injectable()
export class TransactionalInterceptor implements NestInterceptor {
  constructor(private readonly context: AuthTransactionContext) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = executionContext.getHandler();
    const isTransactional = Reflect.getMetadata(AUTH_TRANSACTIONAL_KEY, handler) === true;

    if (!isTransactional) {
      return next.handle();
    }

    return from(this.context.run(async () => next.handle()));
  }
}
