import type { PinoLogger } from 'nestjs-pino';
import type { Socket } from 'socket.io';
import { CoinGateway } from './coin.gateway';

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

const makeSocket = (overrides: Partial<FakeSocket> = {}): FakeSocket => ({
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
});

const makeLogger = (): PinoLogger =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as PinoLogger;

describe('CoinGateway.handleConnection', () => {
  it('disconnects immediately when there is no authenticated user', () => {
    const logger = makeLogger();
    const gateway = new CoinGateway(logger);
    const socket = makeSocket({ data: {} });

    gateway.handleConnection(socket as unknown as Socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('keeps the connection open when the user is authenticated', () => {
    const logger = makeLogger();
    const gateway = new CoinGateway(logger);
    const socket = makeSocket({
      user: { sub: 'user-42' },
      handshake: { auth: { token: 'x' }, headers: {}, address: '127.0.0.1' },
    });

    gateway.handleConnection(socket as unknown as Socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('user:user-42');
  });

  it('handlePing returns local count without cross-node fetchSockets', async () => {
    const logger = makeLogger();
    const gateway = new CoinGateway(logger);

    const socketA = makeSocket({
      id: 'sock-a',
      user: { sub: 'user-42' },
    });
    const socketB = makeSocket({
      id: 'sock-b',
      user: { sub: 'user-42' },
    });

    gateway.handleConnection(socketA as unknown as Socket);
    gateway.handleConnection(socketB as unknown as Socket);

    const result = await gateway.handlePing({ sub: 'user-42' } as never);

    expect(result).toEqual({ ok: true, connectedCount: 2, localCount: 2 });
    expect(gateway.server).toBeUndefined();
  });
});
