import { Catch, ArgumentsHost, UnauthorizedException } from '@nestjs/common';

@Catch()
export class WsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient();

    if (exception instanceof UnauthorizedException) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    client.emit('error', { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
}
