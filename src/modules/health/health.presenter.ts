import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { HealthStatusDto } from './dto/health-status.dto';

@Injectable()
export class HealthPresenter {
  check(payload: HealthStatusDto): ApiResponseEnvelope<HealthStatusDto> {
    return ApiResponse.ok(payload);
  }
}
