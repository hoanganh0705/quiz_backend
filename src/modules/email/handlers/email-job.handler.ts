import type { PinoLogger } from 'nestjs-pino';

export interface EmailJobContext {
  readonly jobId: string | undefined;
  readonly correlationId: string;
  readonly logger: PinoLogger;
}

export interface EmailJobHandler<TData> {
  readonly jobName: string;
  process(data: TData, ctx: EmailJobContext): Promise<void>;
}
