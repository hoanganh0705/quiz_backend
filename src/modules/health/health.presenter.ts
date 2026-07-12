import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { HealthStatusDto } from './dto/health-status.dto';

/**
 * Presenter for the health module. Currently a thin pass-through to
 * {@link ApiResponse.ok}, but lives in its own file to give the layer a stable
 * seam for future module-specific shaping (e.g. conditional redaction of
 * internal-only fields, additional aggregate fields in `meta`).
 */
@Injectable()
export class HealthPresenter {
  check(payload: HealthStatusDto): ApiResponseEnvelope<HealthStatusDto> {
    return ApiResponse.ok(payload);
  }
}
