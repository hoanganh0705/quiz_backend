export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export class SeedLogger {
  private logs: LogEntry[] = [];

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'info', message, meta });
    console.log(this.format('INFO', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'warn', message, meta });
    console.warn(this.format('WARN', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'error', message, meta });
    console.error(this.format('ERROR', message, meta));
  }

  group(label: string, fn: () => Promise<void>): Promise<void> {
    console.log(`\n━━━ ${label} ━━━`);
    return fn().then(() => {
      console.log(`━━━ ${label} done ━━━\n`);
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

export const logger = new SeedLogger();
