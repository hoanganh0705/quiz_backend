import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

type ResponseMeta = {
  timestamp: string;
  [key: string]: unknown;
};

type FormattedResponse<T, TMeta extends ResponseMeta = ResponseMeta> = {
  data: T | null;
  meta: TMeta;
};

type PaginatedPayload = {
  items: unknown;
  pagination: Record<string, unknown>;
};

const MAX_NESTING_DEPTH = 10;

@Injectable()
export class ResponseFormatInterceptor<T> implements NestInterceptor<T, FormattedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<FormattedResponse<T>> {
    return next.handle().pipe(
      map((payload: T) => {
        if (this.shouldBypass(context, payload)) {
          return payload as FormattedResponse<T>;
        }

        return this.formatPayload(payload);
      }),
    );
  }

  private formatPayload(payload: T): FormattedResponse<T> {
    if (isFormattedResponse(payload)) {
      return {
        data: normalizeTemporalFields(payload.data, 0) as T | null,
        meta: normalizeTemporalFields(payload.meta, 0) as ResponseMeta,
      };
    }

    const normalized = normalizeTemporalFields(payload ?? null, 0);

    if (isPaginatedPayload(normalized)) {
      return {
        data: normalized.items as T,
        meta: {
          timestamp: new Date().toISOString(),
          pagination: normalized.pagination,
        },
      };
    }

    return {
      data: normalized as T | null,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
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

function isPaginatedPayload(value: unknown): value is PaginatedPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!('items' in value) || !('pagination' in value)) {
    return false;
  }

  const pagination = value.pagination;
  return isPlainObject(pagination);
}

function isFormattedResponse(value: unknown): value is FormattedResponse<unknown> {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!('data' in value) || !('meta' in value)) {
    return false;
  }

  const meta = value.meta;
  if (!isPlainObject(meta)) {
    return false;
  }

  return typeof meta.timestamp === 'string';
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
