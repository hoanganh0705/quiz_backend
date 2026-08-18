import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';

import { HomeBundleResponseDto } from '../../dto/response/home-bundle-response.dto';

/**
 * Presenter for the home module. Wraps the bundle in the
 * canonical `{ data, meta.timestamp }` envelope.
 */
@Injectable()
export class HomePresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly getBundle = HomePresenter.ok<HomeBundleResponseDto>;
}
