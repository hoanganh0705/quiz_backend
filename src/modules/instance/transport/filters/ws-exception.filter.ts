import {
  Catch,
  ArgumentsHost,
  UnauthorizedException,
  Injectable,
  HttpException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainException } from '@/common/errors/base-domain.exception';

interface WsClient {
  emit(event: string, data: unknown): void;
}

@Injectable()
@Catch()
export class WsExceptionFilter {
  constructor(
    @InjectPinoLogger(WsExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<WsClient>();
    const data = host.switchToWs().getData<unknown>();

    if (exception instanceof UnauthorizedException) {
      this.logger.warn({
        event: 'ws_unauthorized',
        message: exception.message,
        payloadType: typeof data,
      });
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (exception instanceof BaseDomainException) {
      this.logger.warn({
        event: 'ws_domain_error',
        code: exception.code,
        message: exception.message,
      });
      client.emit('error', { code: exception.code, message: exception.message });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? exception.message);
      this.logger.warn({
        event: 'ws_http_error',
        status,
        message,
      });
      client.emit('error', { code: `HTTP_${status}`, message });
      return;
    }

    this.logger.error({
      event: 'ws_unhandled_error',
      error: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    });
    client.emit('error', { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
}
