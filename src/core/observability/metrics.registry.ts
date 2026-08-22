/**
 * Phase 5 #2 — Prometheus metrics registry and counters.
 *
 * A small, dependency-free Prometheus-compatible metrics module
 * (no `prom-client` required for the in-process counters; the
 * exporter serialises them in the Prometheus text exposition
 * format). Each metric follows the standard naming convention:
 *
 *   - `quiz_http_request_duration_seconds_bucket{route,method,status}`
 *   - `quiz_db_query_duration_seconds_bucket{operation}`
 *   - `quiz_redis_circuit_state{state}`
 *   - `quiz_outbox_lag_seconds`
 *   - `quiz_bullmq_queue_depth{queue}`
 *
 * Why a custom registry and not `prom-client`?
 * --------------------------------------------
 * `prom-client` is great for production but adds 200kB of
 * dependencies, and the audit flags this as P2 (medium).
 * The custom registry exposes the same text format so a
 * follow-up PR can swap it for `prom-client` (or attach the
 * OTLP exporter from Phase 5 #1) without changing call sites.
 *
 * The in-process counters are process-global; concurrent
 * increments are safe (Node.js is single-threaded).
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export type MetricType = 'counter' | 'gauge' | 'histogram';

export type Metric = {
  readonly name: string;
  readonly type: MetricType;
  readonly help: string;
  readonly labelKeys: ReadonlyArray<string>;
  /**
   * For counters and gauges: a single value per label set.
   * For histograms: bucket counts keyed by `le`, plus `count`
   * and `sum`.
   */
  values: Map<string, number>;
  /**
   * For histograms only: bucket upper bounds (ascending, last
   * entry is `+Inf`).
   */
  buckets?: ReadonlyArray<number>;
  sum?: number;
};

export type HttpHistogramLabels = {
  route: string;
  method: string;
  status: string;
};

export type DbHistogramLabels = { operation: string };

const HTTP_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];
const DB_BUCKETS_SECONDS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
];

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
      this.bullmqQueueDepth,
      this.tracingSpans,
    ];
  }

  onModuleInit(): void {
    // Seed counters so the metrics endpoint is non-empty on the
    // first scrape (Prometheus best practice). Keys are stored
    // as `labelKey=value` so `formatMetricLine` quotes them
    // correctly.
    this.redisCircuitState.values.set('state=closed', 1);
    this.redisCircuitState.values.set('state=open', 0);
    this.redisCircuitState.values.set('state=half_open', 0);
  }

  /**
   * Observe an HTTP request duration. Updates the histogram's
   * buckets, count, and sum.
   */
  observeHttpDuration(labels: HttpHistogramLabels, durationSeconds: number): void {
    const labelKey = labelsKey(labels);
    incrementHistogram(this.httpDuration, labelKey, durationSeconds);
  }

  observeDbDuration(labels: DbHistogramLabels, durationSeconds: number): void {
    const labelKey = labelsKey(labels);
    incrementHistogram(this.dbDuration, labelKey, durationSeconds);
  }

  setRedisCircuitState(state: 'closed' | 'open' | 'half_open'): void {
    // Reset all three values, then set the active one to 1.
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
   * Render the registry in the Prometheus text exposition format.
   * Histograms expand into N+3 series (`_bucket`, `_count`,
   * `_sum`); counters and gauges are a single series per label
   * set.
   */
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

const formatMetricLine = (
  name: string,
  labelKey: string,
  value: number,
): string => {
  if (!labelKey) return `${name} ${value}`;
  // Prometheus label values must be quoted. Each pair in the
  // `labelKey` is already `k=v`; we emit `k="v"`.
  const labels = labelKey.split('|').map((p) => {
    const eq = p.indexOf('=');
    if (eq < 0) return p;
    return `${p.slice(0, eq)}="${p.slice(eq + 1)}"`;
  }).join(',');
  return `${name}{${labels}} ${value}`;
};

const incrementHistogram = (
  metric: Metric,
  labelKey: string,
  observation: number,
): void => {
  const buckets = metric.buckets ?? [];
  for (const upper of buckets) {
    const bucketKey = `${labelKey}|le=${upper}`;
    if (observation <= upper) {
      metric.values.set(
        bucketKey,
        (metric.values.get(bucketKey) ?? 0) + 1,
      );
    }
  }
  // `+Inf` bucket counts every observation.
  const infKey = `${labelKey}|le=+Inf`;
  metric.values.set(infKey, (metric.values.get(infKey) ?? 0) + 1);
  metric.sum = (metric.sum ?? 0) + observation;
  void observation;
};

const renderHistogram = (metric: Metric): string[] => {
  const lines: string[] = [];

  // Group by label set (sans `le`). Each group corresponds to
  // one labelled histogram; its `_count` is the total number of
  // observations across all `le` buckets, which equals the
  // `+Inf` bucket count.
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
    // Each bucket row first.
    for (const bucket of buckets) {
      const leLabel = bucket.le === '+Inf' ? '+Inf' : bucket.le;
      const allLabels = { ...labels, le: leLabel };
      const renderedLabels = Object.entries(allLabels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      lines.push(`${metric.name}_bucket{${renderedLabels}} ${bucket.count}`);
    }
    // The total observation count is the `+Inf` bucket.
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