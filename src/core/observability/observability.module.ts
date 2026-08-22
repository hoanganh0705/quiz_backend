/**
 * Phase 5 #1 — Observability module.
 *
 * Registers `TracingProvider` and `MetricsRegistry` in the
 * application DI container so every layer (HTTP interceptors,
 * DB middleware, Redis client, BullMQ worker) can `Inject(...)`
 * the tracer and metric counters. The provider APIs are
 * OpenTelemetry-shaped so a follow-up PR can swap the
 * in-process implementation for the real
 * `@opentelemetry/sdk-node` without touching call sites.
 *
 * The `MetricsController` lives in the health module because
 * it depends on `HealthQueueProbe`, which is registered there.
 * The registry itself is provided here so it can be
 * `@Inject(METRICS_REGISTRY)`-ed anywhere.
 */
import { Global, Module } from '@nestjs/common';
import { TracingProvider, TRACING_PROVIDER } from './tracing.provider';
import { MetricsRegistry, METRICS_REGISTRY } from './metrics.registry';

@Global()
@Module({
  providers: [
    TracingProvider,
    MetricsRegistry,
    { provide: METRICS_REGISTRY, useExisting: MetricsRegistry },
    { provide: TRACING_PROVIDER, useExisting: TracingProvider },
  ],
  exports: [
    TracingProvider,
    MetricsRegistry,
    METRICS_REGISTRY,
    TRACING_PROVIDER,
  ],
})
export class ObservabilityModule {}