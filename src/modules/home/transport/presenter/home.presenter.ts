import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';

import { HomeBundleResponseDto } from '../../dto/response/home-bundle-response.dto';

@Injectable()
export class HomePresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly getBundle = HomePresenter.ok<HomeBundleResponseDto>;
}
