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
import { normalizeTemporalFields } from '@/common/utils/temporal-normalizer.util';

type ResponseMeta = {
  timestamp: string;
  [key: string]: unknown;
};

type FormattedResponse<T> = {
  data: T | null;
  meta: ResponseMeta;
};

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
          data: normalizeTemporalFields(payload ?? null) as T | null,
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
