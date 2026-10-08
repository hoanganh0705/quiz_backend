import pino, { type Logger as PinoLogger, type DestinationStream } from 'pino';
import { REDACT_PATHS } from '@/core/logger/pino.config';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export const SEED_REDACT_PATHS = REDACT_PATHS;

export const buildSeedPinoLogger = (destination?: DestinationStream): PinoLogger =>
  pino(
    {
      redact: {
        paths: [...SEED_REDACT_PATHS],
        censor: '[REDACTED]',
        remove: false,
      },
      base: { app: 'seed' },
    },
    destination,
  );

export class SeedLogger {
  private logs: LogEntry[] = [];
  private readonly sink: PinoLogger | null;

  constructor(sink: PinoLogger | null = null) {
    this.sink = sink;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'info', message, meta });
    if (this.sink) {
      this.sink.info({ ...(meta ?? {}), msg: message });
    } else {
      console.log(this.format('INFO', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'warn', message, meta });
    if (this.sink) {
      this.sink.warn({ ...(meta ?? {}), msg: message });
    } else {
      console.warn(this.format('WARN', message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'error', message, meta });
    if (this.sink) {
      this.sink.error({ ...(meta ?? {}), msg: message });
    } else {
      console.error(this.format('ERROR', message, meta));
    }
  }

  group(label: string, fn: () => Promise<void>): Promise<void> {
    if (this.sink) {
      this.sink.info(`━━━ ${label} ━━━`);
    } else {
      console.log(`\n━━━ ${label} ━━━`);
    }
    return fn().then(() => {
      if (this.sink) {
        this.sink.info(`━━━ ${label} done ━━━`);
      } else {
        console.log(`━━━ ${label} done ━━━\n`);
      }
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  private format(level: string, message: string, meta?: Record<string, unknown>): string {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${level}] ${message}${metaStr}`;
  }
}

export const buildSeedLogger = (destination?: DestinationStream): SeedLogger =>
  new SeedLogger(buildSeedPinoLogger(destination));

export const logger = buildSeedLogger();
