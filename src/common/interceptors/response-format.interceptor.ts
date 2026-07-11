import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, map } from 'rxjs';
import { isApiResponse } from '@/common/responses/api-response';

type ResponseMeta = {
  timestamp: string;
  [key: string]: unknown;
};

type FormattedResponse<T> = {
  data: T | null;
  meta: ResponseMeta;
};

const MAX_NESTING_DEPTH = 10;

@Injectable()
export class ResponseFormatInterceptor<T> implements NestInterceptor<T, FormattedResponse<T>> {
  constructor(
    @InjectPinoLogger(ResponseFormatInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<FormattedResponse<T>> {
    return next.handle().pipe(
      map((payload: T) => {
        if (this.shouldBypass(context, payload)) {
          return payload as FormattedResponse<T>;
        }

        if (isApiResponse(payload)) {
          return payload as FormattedResponse<T>;
        }

        this.logger.warn(
          {
            event: 'response_format_interceptor.envelope_drift',
            reason: 'payload did not match ApiResponse envelope shape; wrapping as data.',
          },
          'ResponseFormatInterceptor: payload did not match envelope shape; wrapping as data.',
        );

        return {
          data: normalizeTemporalFields(payload ?? null, 0) as T | null,
          meta: { timestamp: new Date().toISOString() },
        };
      }),
    );
  }

  private shouldBypass(context: ExecutionContext, payload: unknown): boolean {
    return isStreamableFile(payload) || this.isNativeResponseHandled(context);
  }

  private isNativeResponseHandled(context: ExecutionContext): boolean {
    if (context.getType<'http'>() !== 'http') {
      return false;
    }

    const response = context.switchToHttp().getResponse<{
      headersSent?: boolean;
      writableEnded?: boolean;
    }>();

    return Boolean(response?.headersSent || response?.writableEnded);
  }
}

function isStreamableFile(value: unknown): value is StreamableFile {
  return value instanceof StreamableFile;
}

function isTemporalKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.endsWith('time') ||
    normalized.endsWith('timestamp') ||
    normalized.endsWith('date') ||
    normalized.endsWith('at')
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

function normalizeTemporalFields(value: unknown, depth: number): unknown {
  if (depth > MAX_NESTING_DEPTH) {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTemporalFields(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const normalized: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value)) {
      const processed = normalizeTemporalFields(entryValue, depth + 1);

      if (isTemporalKey(key) && typeof processed === 'string') {
        normalized[key] = normalizeIsoString(processed);
      } else {
        normalized[key] = processed;
      }
    }

    return normalized;
  }

  return value;
}

function normalizeIsoString(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  const normalized = new Date(parsed).toISOString();
  return normalized !== value ? normalized : value;
}
