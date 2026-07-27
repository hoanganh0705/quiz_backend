import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { SearchResponseDto } from '../dto/response/search-response.dto';

/**
 * Presenter for the global search module. Wraps the application service's
 * `SearchResponseDto` (an aggregate of users, quizzes, and comment results)
 * in the canonical envelope. Currently a thin pass-through to {@link ApiResponse.ok}.
 */
@Injectable()
export class SearchPresenter {
  search(payload: SearchResponseDto): ApiResponseEnvelope<SearchResponseDto> {
    return ApiResponse.ok(payload);
  }
}
