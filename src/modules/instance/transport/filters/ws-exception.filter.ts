import { Catch, ArgumentsHost } from '@nestjs/common';

@Catch()
export class WsExceptionFilter {
  catch(_exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient();
    // Never expose raw exception details over WebSocket.
    client.emit('error', { message: 'An unexpected error occurred' });
  }
}
