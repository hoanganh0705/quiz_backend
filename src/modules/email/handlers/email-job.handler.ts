import type { Job } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';

/**
 * Context handed to an `EmailJobHandler.process` call.
 *
 * Decoupled from the worker so handlers can be unit-tested with a
 * stub `Job` and logger, and so the dispatcher can stamp a
 * correlationId onto the AsyncLocalStorage without each handler
 * having to repeat that plumbing.
 */
export interface EmailJobContext {
  readonly jobId: string | undefined;
  readonly correlationId: string;
  readonly logger: PinoLogger;
}

/**
 * Contract every email job handler implements.
 *
 * `jobName` is the BullMQ job name the dispatcher uses to route
 * incoming jobs to this handler. It MUST match the value the
 * matching `EmailService.enqueue*` method publishes with.
 *
 * `process` performs the actual side effects (idempotency check,
 * provider call, logging). The dispatcher wraps it in
 * `correlationIdStorage.run(...)` and re-throws errors so BullMQ's
 * exponential backoff applies.
 */
export interface EmailJobHandler<TData> {
  readonly jobName: string;
  process(data: TData, ctx: EmailJobContext): Promise<void>;
}

/**
 * Narrower view of a BullMQ `Job` that handlers need.
 *
 * Avoids leaking `BullMQ.Job`'s full generic surface into every
 * handler file. The dispatcher constructs one of these before
 * invoking `process`.
 */
export type EmailJobShape<TData> = Pick<Job<TData>, 'id' | 'data' | 'name'>;
