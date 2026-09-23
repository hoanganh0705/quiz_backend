import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { SearchResponseDto } from '../dto/response/search-response.dto';

@Injectable()
export class SearchPresenter {
  search(payload: SearchResponseDto): ApiResponseEnvelope<SearchResponseDto> {
    return ApiResponse.ok(payload);
  }
}
