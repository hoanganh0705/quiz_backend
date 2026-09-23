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
      this.outboxDlqCount,
      this.bullmqQueueDepth,
      this.tracingSpans,
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
