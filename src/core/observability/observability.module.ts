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
  exports: [TracingProvider, MetricsRegistry, METRICS_REGISTRY, TRACING_PROVIDER],
})
export class ObservabilityModule {}
