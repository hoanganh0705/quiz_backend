/**
 * BullMQ job data for the email queue.
 *
 * The `correlationId` field is captured at enqueue time from the
 * current `correlationIdStorage` AsyncLocalStorage (which the
 * `CorrelationInterceptor` populates for every HTTP request).
 * It travels with the job through Redis, and the worker
 * restores it into AsyncLocalStorage before processing so that
 * every log line inside the worker — pino child loggers,
 * `nestjs-pino` request-scoped metadata, downstream services
 * that call `getCorrelationId()` — joins the same correlation
 * chain as the originating HTTP request.
 *
 * Why a typed field rather than stamping on `job.id`
 * -----------------------------------------------
 * The audit suggested setting `job.id = correlationId`. That
 * would conflate two different identifiers:
 *   - `jobId` is BullMQ's own deduplication / job-state key.
 *     Setting it to a UUID means every job with a fresh
 *     correlation ID is a brand-new row, which is fine for
 *     verification emails (we *want* one job per request) but
 *     breaks the standard BullMQ deduplication story for
 *     retries of the *same* enqueue — the second attempt
 *     would create a duplicate job rather than be deduplicated
 *     by jobId.
 *   - `correlationId` is a tracing concern, independent of
 *     BullMQ's job lifecycle.
 *
 * The clean separation is: keep BullMQ's jobId (auto-generated
 * integer) as the queue identifier, and put the correlation ID
 * on the job data where every consumer can read it.
 */
export type EmailJobDataBase = {
  email: string;
  token: string;
  userId?: string;
  correlationId?: string;
};

export type SendVerificationEmailJobData = EmailJobDataBase & {
  userId?: string;
};

export type SendPasswordResetEmailJobData = EmailJobDataBase & {
  userId: string;
};
