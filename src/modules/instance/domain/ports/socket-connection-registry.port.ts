import type { JwtPayload } from '@/common/guards/jwt.guard';
export type SocketConnectionMeta = {
  instanceId: string;

  userId: string;
};

export type SocketConnectionRegistryPort = {
  record(socketId: string, meta: SocketConnectionMeta): Promise<boolean>;

  getMeta(socketId: string): Promise<SocketConnectionMeta | null>;

  consume(socketId: string): Promise<SocketConnectionMeta | null>;

  setTtlMs(ttlMs: number): void;

  getTtlMs(): number;
};

export const SOCKET_CONNECTION_REGISTRY_PORT = Symbol('SocketConnectionRegistryPort');

export type _SocketConnectionUserContext = Pick<JwtPayload, 'sub'>;
