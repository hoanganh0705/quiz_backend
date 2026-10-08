import type { PinoLogger } from 'nestjs-pino';
import type { Socket } from 'socket.io';
import { NotificationGateway } from './notification.gateway';

interface FakeSocket {
  id: string;
  data: Record<string, unknown>;
  user?: { sub?: string };
  handshake: {
    auth?: { token?: string };
    headers: Record<string, string | string[] | undefined>;
    address?: string;
  };
  rooms: Set<string>;
  join: jest.Mock;
  leave: jest.Mock;
  disconnect: jest.Mock;
  emit: jest.Mock;
}

const makeSocket = (overrides: Partial<FakeSocket> = {}): FakeSocket => {
  const socket: FakeSocket = {
    id: overrides.id ?? 'sock-1',
    data: overrides.data ?? {},
    user: overrides.user,
    handshake: overrides.handshake ?? {
      auth: {},
      headers: {},
      address: '127.0.0.1',
    },
    rooms: overrides.rooms ?? new Set(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    emit: jest.fn(),
  };
  return socket;
};

const makeLogger = (): PinoLogger =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as PinoLogger;

describe('NotificationGateway.handleConnection', () => {
  it('disconnects the socket immediately when there is no authenticated user', () => {
    const logger = makeLogger();
    const gateway = new NotificationGateway(logger);
    const socket = makeSocket({ data: {} });

    gateway.handleConnection(socket as unknown as Socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('logs the disconnect at info level (event: ws_unauth_disconnect)', () => {
    const logger = makeLogger();
    const gateway = new NotificationGateway(logger);
    const socket = makeSocket({ data: {} });

    gateway.handleConnection(socket as unknown as Socket);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ws_unauth_disconnect', socketId: socket.id }),
    );
  });

  it('keeps the connection open when the user is authenticated', () => {
    const logger = makeLogger();
    const gateway = new NotificationGateway(logger);
    const socket = makeSocket({
      user: { sub: 'user-42' },
      handshake: { auth: { token: 'x' }, headers: {}, address: '127.0.0.1' },
    });

    gateway.handleConnection(socket as unknown as Socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('user:user-42');
  });
});
