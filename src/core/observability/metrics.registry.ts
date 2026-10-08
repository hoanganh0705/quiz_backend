import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export type MetricType = 'counter' | 'gauge' | 'histogram';

export type Metric = {
  readonly name: string;
  readonly type: MetricType;
  readonly help: string;
  readonly labelKeys: ReadonlyArray<string>;
  values: Map<string, number>;
  buckets?: ReadonlyArray<number>;
  sum?: number;
};

export type HttpHistogramLabels = {
  route: string;
  method: string;
  status: string;
};

export type DbHistogramLabels = { operation: string };

const HTTP_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const DB_BUCKETS_SECONDS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

@Injectable()
export class MetricsRegistry implements OnModuleInit {
  readonly httpDuration: Metric = {
    name: 'quiz_http_request_duration_seconds',
    type: 'histogram',
    help: 'HTTP request duration in seconds',
    labelKeys: ['route', 'method', 'status'],
    values: new Map(),
    buckets: HTTP_BUCKETS_SECONDS,
    sum: 0,
  };
  readonly dbDuration: Metric = {
    name: 'quiz_db_query_duration_seconds',
    type: 'histogram',
    help: 'Database query duration in seconds',
    labelKeys: ['operation'],
    values: new Map(),
    buckets: DB_BUCKETS_SECONDS,
    sum: 0,
  };
  readonly redisCircuitState: Metric = {
    name: 'quiz_redis_circuit_state',
    type: 'gauge',
    help: 'Redis circuit-breaker state (0=closed, 1=open, 2=half_open)',
    labelKeys: ['state'],
    values: new Map(),
  };
  readonly redisCircuitShortCircuits: Metric = {
    name: 'quiz_redis_circuit_short_circuited_total',
    type: 'counter',
    help: 'Number of Redis calls short-circuited by the breaker',
    labelKeys: [],
    values: new Map(),
  };
  readonly outboxLag: Metric = {
    name: 'quiz_outbox_lag_seconds',
    type: 'gauge',
    help: 'Age of the oldest unprocessed outbox event in seconds',
    labelKeys: [],
    values: new Map(),
  };
  readonly outboxDlqCount: Metric = {
    name: 'quiz_outbox_dlq_total',
    type: 'gauge',
    help: 'Number of outbox events in the dead-letter queue, broken down by aggregate_type',
    labelKeys: ['aggregate_type'],
    values: new Map(),
  };
  readonly outboxHandlerFailed: Metric = {
    name: 'quiz_outbox_handler_failed_total',
    type: 'counter',
    help: 'Number of outbox handler invocations that rejected after dispatch',
    labelKeys: ['aggregate_type'],
    values: new Map(),
  };
  readonly xpIngestDuplicateSkipped: Metric = {
    name: 'quiz_xp_ingest_duplicate_skipped_total',
    type: 'counter',
    help: 'Number of XP ingestion calls skipped because the dedupe key was already claimed',
    labelKeys: ['source'],
    values: new Map(),
  };
  readonly bullmqQueueDepth: Metric = {
    name: 'quiz_bullmq_queue_depth',
    type: 'gauge',
    help: 'BullMQ queue depth (waiting + active + delayed)',
    labelKeys: ['queue'],
    values: new Map(),
  };
  readonly tracingSpans: Metric = {
    name: 'quiz_tracing_active_spans',
    type: 'gauge',
    help: 'Number of currently active tracing spans',
    labelKeys: [],
    values: new Map(),
  };
  readonly authRateLimiterFailOpen: Metric = {
    name: 'quiz_auth_rate_limiter_fail_open_total',
    type: 'counter',
    help: 'Number of auth rate-limit checks that fell open because the Redis circuit was open',
    labelKeys: ['bucket'],
    values: new Map(),
  };
  readonly schedulerSkipped: Metric = {
    name: 'quiz_scheduler_skipped_total',
    type: 'counter',
    help: 'Number of cron-job skips caused by the Redis circuit being open',
    labelKeys: ['job'],
    values: new Map(),
  };
  readonly cacheInvalidationFailed: Metric = {
    name: 'quiz_cache_invalidation_failed_total',
    type: 'counter',
    help: 'Number of cache invalidation attempts that failed (best-effort)',
    labelKeys: ['cache'],
    values: new Map(),
  };
  readonly cacheHit: Metric = {
    name: 'quiz_cache_hit_total',
    type: 'counter',
    help: 'Number of cache reads that returned a value',
    labelKeys: ['cache'],
    values: new Map(),
  };
  readonly retryQueueDlqSize: Metric = {
    name: 'quiz_retry_queue_dlq_size',
    type: 'gauge',
    help: 'Number of events currently sitting in the in-process retry-queue dead-letter list, per tier',
    labelKeys: ['tier'],
    values: new Map(),
  };
  readonly cacheMiss: Metric = {
    name: 'quiz_cache_miss_total',
    type: 'counter',
    help: 'Number of cache reads that returned no value',
    labelKeys: ['cache'],
    values: new Map(),
  };
  readonly wsThrottlerRejections: Metric = {
    name: 'quiz_ws_throttler_rejections_total',
    type: 'counter',
    help: 'Number of WebSocket messages rejected by the per-user throttler',
    labelKeys: ['namespace', 'handler'],
    values: new Map(),
  };
  readonly httpLogVolume: Metric = {
    name: 'quiz_http_log_volume_total',
    type: 'counter',
    help: 'Per-path HTTP request volume observed by the request logger (independent of pino autoLogging.ignore, so operators can decide future filtering)',
    labelKeys: ['path', 'method', 'status'],
    values: new Map(),
  };

  private readonly allMetrics: Metric[];

  constructor(
    @InjectPinoLogger(MetricsRegistry.name)
    private readonly logger: PinoLogger,
  ) {
    this.allMetrics = [
      this.httpDuration,
      this.dbDuration,
      this.redisCircuitState,
      this.redisCircuitShortCircuits,
      this.outboxLag,
      this.outboxDlqCount,
      this.outboxHandlerFailed,
      this.xpIngestDuplicateSkipped,
      this.bullmqQueueDepth,
      this.tracingSpans,
      this.authRateLimiterFailOpen,
      this.schedulerSkipped,
      this.retryQueueDlqSize,
      this.cacheInvalidationFailed,
      this.cacheHit,
      this.cacheMiss,
      this.wsThrottlerRejections,
      this.httpLogVolume,
    ];
  }

  onModuleInit(): void {
    this.redisCircuitState.values.set('state=closed', 1);
    this.redisCircuitState.values.set('state=open', 0);
    this.redisCircuitState.values.set('state=half_open', 0);
  }

  observeHttpDuration(labels: HttpHistogramLabels, durationSeconds: number): void {
    const labelKey = labelsKey(labels);
    incrementHistogram(this.httpDuration, labelKey, durationSeconds);
  }

  observeDbDuration(labels: DbHistogramLabels, durationSeconds: number): void {
    const labelKey = labelsKey(labels);
    incrementHistogram(this.dbDuration, labelKey, durationSeconds);
  }

  setRedisCircuitState(state: 'closed' | 'open' | 'half_open'): void {
    this.redisCircuitState.values.set('state=closed', 0);
    this.redisCircuitState.values.set('state=open', 0);
    this.redisCircuitState.values.set('state=half_open', 0);
    this.redisCircuitState.values.set(`state=${state}`, 1);
  }

  incRedisCircuitShortCircuits(): void {
    this.redisCircuitShortCircuits.values.set(
      'total=short_circuited',
      (this.redisCircuitShortCircuits.values.get('total=short_circuited') ?? 0) + 1,
    );
  }

  setOutboxLag(seconds: number): void {
    this.outboxLag.values.set('series=lag', seconds);
  }

  setBullmqQueueDepth(queue: string, depth: number): void {
    this.bullmqQueueDepth.values.set(`queue=${queue}`, depth);
  }

  setTracingActiveSpans(count: number): void {
    this.tracingSpans.values.set('series=active', count);
  }

  /**
   * Set DLQ event count per aggregate type.
   * Called by MetricsController on every scrape so Prometheus alerting
   * can fire when any count is non-zero.
   */
  setOutboxDlqCount(aggregateType: string, count: number): void {
    this.outboxDlqCount.values.set(`aggregate_type=${aggregateType}`, count);
  }

  incOutboxHandlerFailed(aggregateType: string): void {
    const labelKey = `aggregate_type=${aggregateType}`;
    this.outboxHandlerFailed.values.set(
      labelKey,
      (this.outboxHandlerFailed.values.get(labelKey) ?? 0) + 1,
    );
  }

  incXpIngestDuplicateSkipped(source: 'in_proc' | 'outbox' | 'manual'): void {
    const labelKey = `source=${source}`;
    this.xpIngestDuplicateSkipped.values.set(
      labelKey,
      (this.xpIngestDuplicateSkipped.values.get(labelKey) ?? 0) + 1,
    );
  }

  incAuthRateLimiterFailOpen(bucket: string): void {
    const labelKey = `bucket=${bucket}`;
    this.authRateLimiterFailOpen.values.set(
      labelKey,
      (this.authRateLimiterFailOpen.values.get(labelKey) ?? 0) + 1,
    );
  }

  incSchedulerSkipped(job: string): void {
    const labelKey = `job=${job}`;
    this.schedulerSkipped.values.set(
      labelKey,
      (this.schedulerSkipped.values.get(labelKey) ?? 0) + 1,
    );
  }

  incCacheInvalidationFailed(cache: string): void {
    const labelKey = `cache=${cache}`;
    this.cacheInvalidationFailed.values.set(
      labelKey,
      (this.cacheInvalidationFailed.values.get(labelKey) ?? 0) + 1,
    );
  }

  incCacheHit(cache: string): void {
    const labelKey = `cache=${cache}`;
    this.cacheHit.values.set(labelKey, (this.cacheHit.values.get(labelKey) ?? 0) + 1);
  }

  incCacheMiss(cache: string): void {
    const labelKey = `cache=${cache}`;
    this.cacheMiss.values.set(labelKey, (this.cacheMiss.values.get(labelKey) ?? 0) + 1);
  }

  incWsThrottlerRejected(namespace: string, handler: string): void {
    const labelKey = `namespace=${namespace},handler=${handler}`;
    this.wsThrottlerRejections.values.set(
      labelKey,
      (this.wsThrottlerRejections.values.get(labelKey) ?? 0) + 1,
    );
  }

  incHttpLogVolume(path: string, method: string, status: string): void {
    const labelKey = labelsKey({ path, method, status });
    this.httpLogVolume.values.set(labelKey, (this.httpLogVolume.values.get(labelKey) ?? 0) + 1);
  }

  setRetryQueueDlqSize(tier: string, size: number): void {
    const labelKey = `tier=${tier}`;
    this.retryQueueDlqSize.values.set(labelKey, size);
  }

  render(): string {
    const lines: string[] = [];
    for (const metric of this.allMetrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      if (metric.type === 'histogram') {
        lines.push(...renderHistogram(metric));
      } else {
        for (const [labelKey, value] of metric.values) {
          lines.push(formatMetricLine(metric.name, labelKey, value));
        }
      }
    }
    return lines.join('\n') + '\n';
  }
}

const labelsKey = (labels: Record<string, string>): string =>
  Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');

const formatMetricLine = (name: string, labelKey: string, value: number): string => {
  if (!labelKey) return `${name} ${value}`;
  const labels = labelKey
    .split('|')
    .map((p) => {
      const eq = p.indexOf('=');
      if (eq < 0) return p;
      return `${p.slice(0, eq)}="${p.slice(eq + 1)}"`;
    })
    .join(',');
  return `${name}{${labels}} ${value}`;
};

const incrementHistogram = (metric: Metric, labelKey: string, observation: number): void => {
  const buckets = metric.buckets ?? [];
  for (const upper of buckets) {
    const bucketKey = `${labelKey}|le=${upper}`;
    if (observation <= upper) {
      metric.values.set(bucketKey, (metric.values.get(bucketKey) ?? 0) + 1);
    }
  }
  const infKey = `${labelKey}|le=+Inf`;
  metric.values.set(infKey, (metric.values.get(infKey) ?? 0) + 1);
  metric.sum = (metric.sum ?? 0) + observation;
  void observation;
};

const renderHistogram = (metric: Metric): string[] => {
  const lines: string[] = [];

  const grouped = new Map<string, Array<{ le: string; count: number }>>();
  for (const [key, value] of metric.values) {
    const [labelPart, lePart] = key.split('|le=');
    if (lePart === undefined) continue;
    const baseKey = labelPart ?? '';
    if (!grouped.has(baseKey)) grouped.set(baseKey, []);
    grouped.get(baseKey)!.push({ le: lePart, count: value });
  }

  for (const [baseKey, buckets] of grouped) {
    const labels = parseLabels(baseKey);
    for (const bucket of buckets) {
      const leLabel = bucket.le === '+Inf' ? '+Inf' : bucket.le;
      const allLabels = { ...labels, le: leLabel };
      const renderedLabels = Object.entries(allLabels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      lines.push(`${metric.name}_bucket{${renderedLabels}} ${bucket.count}`);
    }
    const infBucket = buckets.find((b) => b.le === '+Inf');
    const totalCount = infBucket ? infBucket.count : buckets[buckets.length - 1].count;

    const countLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    if (countLabels) {
      lines.push(`${metric.name}_count{${countLabels}} ${totalCount}`);
    } else {
      lines.push(`${metric.name}_count ${totalCount}`);
    }
    if (metric.sum !== undefined) {
      if (countLabels) {
        lines.push(`${metric.name}_sum{${countLabels}} ${metric.sum}`);
      } else {
        lines.push(`${metric.name}_sum ${metric.sum}`);
      }
    }
  }
  return lines;
};

const parseLabels = (key: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const pair of key.split('|')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
};

export const METRICS_REGISTRY = Symbol('METRICS_REGISTRY');
