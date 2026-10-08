import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Deletes any temporary multer file written under `os.tmpdir()` (the
 * default destination for `diskStorage`) once the response has been
 * sent. The file is removed regardless of success or error so the
 * server doesn't accumulate uploads it no longer needs.
 *
 * Skips in-memory uploads (when `buffer` is populated instead of
 * `path`) so the interceptor stays a no-op for handlers that still
 * use `memoryStorage`.
 */
@Injectable()
export class CleanupTempFileInterceptor implements NestInterceptor {
  private readonly tmpRoot = path.resolve(os.tmpdir());

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ file?: Express.Multer.File }>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.remove(request.file);
        },
        error: () => {
          void this.remove(request.file);
        },
      }),
    );
  }

  private async remove(file: Express.Multer.File | undefined): Promise<void> {
    if (!file || !file.path || file.buffer) return;
    const resolved = path.resolve(file.path);
    if (!resolved.startsWith(`${this.tmpRoot}${path.sep}`)) return;
    try {
      await fs.unlink(resolved);
    } catch {
      // Best-effort cleanup.
    }
  }
}
