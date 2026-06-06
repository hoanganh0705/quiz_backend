import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ReviewApplicationService } from '../../application/review.application.service';
import { CreateReviewDto, UpdateReviewDto, ListReviewsQueryDto, ListMyReviewsQueryDto } from '../../dto/request';
import {
  ReviewListResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
  DeleteReviewResponseDto,
  MyReviewsResponseDto,
} from '../../dto/response';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';
import { ReviewCursorMapper } from '../../mappers/review-cursor.mapper';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseFilters(ReviewDomainExceptionFilter)
export class UserReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Get(':userId/reviews')
  @Public()
  @ApiOperation({
    summary: 'List user reviews',
    description:
      'Returns public reviews created by the specified user, cursor-paginated and ordered by newest review first.',
  })
  @ApiOkResponse({
    description: 'User reviews returned',
    type: MyReviewsResponseDto,
    schema: {
      example: {
        items: [
          {
            reviewId: '550e8400-e29b-41d4-a716-446655440099',
            quizId: '660e8400-e29b-41d4-a716-446655440000',
            quizTitle: 'JavaScript Fundamentals',
            rating: 5,
            content: 'Excellent quiz',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          limit: 10,
          hasNextPage: true,
          nextCursor:
            'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJyZXZpZXdJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async listReviewsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ListMyReviewsQueryDto,
  ): Promise<MyReviewsResponseDto> {
    return this.reviewApplicationService.listReviewsByUser(userId, {
      limit: query.limit,
      cursor: query.cursor ? ReviewCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('me/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my reviews',
    description:
      "Returns reviews created by the authenticated user, cursor-paginated and ordered by newest review first.",
  })
  @ApiOkResponse({
    description: 'My reviews returned',
    type: MyReviewsResponseDto,
    schema: {
      example: {
        items: [
          {
            reviewId: '550e8400-e29b-41d4-a716-446655440099',
            quizId: '660e8400-e29b-41d4-a716-446655440000',
            quizTitle: 'JavaScript Fundamentals',
            rating: 5,
            content: 'Excellent quiz',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          limit: 10,
          hasNextPage: true,
          nextCursor:
            'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJyZXZpZXdJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async listMyReviews(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMyReviewsQueryDto,
  ): Promise<MyReviewsResponseDto> {
    return this.reviewApplicationService.listUserReviews(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? ReviewCursorMapper.parse(query.cursor) : null,
    });
  }
}
