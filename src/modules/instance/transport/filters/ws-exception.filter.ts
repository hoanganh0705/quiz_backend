import { Catch, ArgumentsHost } from '@nestjs/common';

@Catch()
export class WsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    let message = 'Internal server error';

    if (exception instanceof Error) {
      message = exception.message;
    }

    const client = host.switchToWs().getClient();
    client.emit('error', { message });
  }
}
