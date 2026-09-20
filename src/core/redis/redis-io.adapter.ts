import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import Redis from 'ioredis';

export type RedisIoAdapterOptions = {
  key?: string;
  redisOptions?: {
    maxRetriesPerRequest?: number;
    retryStrategy?: (times: number) => number | null;
  };

  redisUrl?: string;
};

export class RedisIoAdapter extends IoAdapter {
  private readonly logger: PinoNestLogger;
  private readonly adapterOptions: RedisIoAdapterOptions;

  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private redisClientsClosed = false;

  constructor(app: INestApplicationContext, options: RedisIoAdapterOptions = {}) {
    super(app);
    this.adapterOptions = options;
    const logger = app.get(PinoNestLogger, { strict: false });
    if (!logger) {
      throw new Error(
        'nestjs-pino Logger is not available — CoreLoggerModule must be registered before useWebSocketAdapter()',
      );
    }
    this.logger = logger;
  }

  private logContext(): string {
    return RedisIoAdapter.name;
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    const { pubClient, subClient } = this.ensureRedisClients();
    server.adapter(
      createAdapter(pubClient, subClient, {
        key: this.adapterOptions.key ?? 'socket.io',
      }),
    );

    this.logger.log(
      {
        event: 'socket.adapter.attached',
        port,
      },
      this.logContext(),
    );

    return server;
  }

  async close(server: Server): Promise<void> {
    await super.close(server);
    if (this.redisClientsClosed) return;
    this.redisClientsClosed = true;

    for (const client of [this.pubClient, this.subClient]) {
      if (!client) continue;
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
    this.pubClient = null;
    this.subClient = null;
  }

  private ensureRedisClients(): { pubClient: Redis; subClient: Redis } {
    if (this.pubClient && this.subClient) {
      return { pubClient: this.pubClient, subClient: this.subClient };
    }

    const url = this.adapterOptions.redisUrl ?? process.env.REDIS_URL;
    if (!url || url.trim().length === 0) {
      throw new Error(
        'REDIS_URL is not defined — Socket.IO Redis adapter requires a live Redis instance',
      );
    }

    const options = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      ...this.adapterOptions.redisOptions,
    };

    this.pubClient = new Redis(url, options);
    this.subClient = new Redis(url, options);

    this.pubClient.on('error', (err: Error) => this.handleClientError('pubClient', err));
    this.subClient.on('error', (err: Error) => this.handleClientError('subClient', err));

    return { pubClient: this.pubClient, subClient: this.subClient };
  }

  private handleClientError(label: 'pubClient' | 'subClient', err: Error): void {
    this.logger.error(
      {
        event: 'socket.adapter.client_error',
        client: label,
        message: err.message,
      },
      this.logContext(),
    );
  }
}
