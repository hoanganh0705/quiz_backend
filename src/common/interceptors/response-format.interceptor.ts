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

const TEMPORAL_KEY_PATTERN = /(time|timestamp|date|at)$/i;

@Injectable()
export class ResponseFormatInterceptor<T> implements NestInterceptor<T, FormattedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<FormattedResponse<T>> {
    return next.handle().pipe(
      map((payload: T): FormattedResponse<T> => {
        if (this.shouldBypass(context, payload)) {
          // Required bypass for native/stream responses where wrapping would break output.
          return payload as FormattedResponse<T>;
        }

        if (this.isAlreadyFormatted(payload)) {
          return {
            data: this.normalizeTemporalFields(payload.data) as T | null,
            meta: this.normalizeTemporalFields(payload.meta) as ResponseMeta,
          };
        }

        const normalizedPayload = this.normalizeTemporalFields(payload ?? null);

        if (this.isPaginatedPayload(normalizedPayload)) {
          return {
            data: normalizedPayload.items as T,
            meta: {
              timestamp: new Date().toISOString(),
              pagination: normalizedPayload.pagination,
            },
          };
        }

        return {
          data: normalizedPayload as T | null,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }

  private shouldBypass(context: ExecutionContext, payload: T): boolean {
    return this.isStreamableFile(payload) || this.isNativeResponseHandled(context);
  }

  private isStreamableFile(value: unknown): value is StreamableFile {
    return value instanceof StreamableFile;
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

  private isAlreadyFormatted(value: unknown): value is FormattedResponse<unknown> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    if (!('data' in candidate) || !('meta' in candidate)) {
      return false;
    }

    const meta = candidate.meta;

    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      return false;
    }

    const metaRecord = meta as Record<string, unknown>;
    const timestamp = metaRecord.timestamp;

    if (typeof timestamp !== 'string') {
      return false;
    }

    return true;
  }

  private isPaginatedPayload(value: unknown): value is PaginatedPayload {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    if (!('items' in candidate) || !('pagination' in candidate)) {
      return false;
    }

    if (!candidate.pagination || typeof candidate.pagination !== 'object') {
      return false;
    }

    if (Array.isArray(candidate.pagination)) {
      return false;
    }

    return true;
  }

  private normalizeTemporalFields(value: unknown, key?: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string' && this.isTemporalKey(key)) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeTemporalFields(item));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const normalized: Record<string, unknown> = {};

      for (const [entryKey, entryValue] of Object.entries(obj)) {
        normalized[entryKey] = this.normalizeTemporalFields(entryValue, entryKey);
      }

      return normalized;
    }

    return value;
  }

  private isTemporalKey(key?: string): boolean {
    if (!key) {
      return false;
    }

    return TEMPORAL_KEY_PATTERN.test(key);
  }
}
