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
import { CreateReviewDto, UpdateReviewDto, ListReviewsQueryDto } from '../../dto/request';
import {
  ReviewListResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
  DeleteReviewResponseDto,
} from '../../dto/response';
import { ReviewDomainExceptionFilter } from '../filters/review-domain-exception.filter';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('quizzes')
@UseFilters(ReviewDomainExceptionFilter)
export class ReviewController {
  constructor(private readonly reviewApplicationService: ReviewApplicationService) {}

  @Post(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Create review',
    description:
      'Creates a star rating and optional written review for a quiz. One review per user per quiz.',
  })
  @ApiCreatedResponse({ description: 'Review created', type: CreateReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz not found' })
  @ApiConflictResponse({ description: 'You have already reviewed this quiz' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async createReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateReviewDto,
  ): Promise<CreateReviewResponseDto> {
    return this.reviewApplicationService.createReview(quizId, payload, user);
  }

  @Get(':quizId/reviews')
  @Public()
  @ApiOperation({
    summary: 'List quiz reviews',
    description: 'Returns a paginated list of reviews for a specific quiz.',
  })
  @ApiOkResponse({ description: 'Reviews returned', type: ReviewListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listReviews(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ReviewListResponseDto> {
    const limit = query.limit ?? 20;
    return this.reviewApplicationService.listReviews(quizId, limit);
  }

  @Patch(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update my review',
    description: "Updates the authenticated user's existing review for a quiz.",
  })
  @ApiOkResponse({ description: 'Review updated', type: UpdateReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or review not found' })
  @ApiConflictResponse({ description: 'You have not reviewed this quiz yet' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async updateReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateReviewDto,
  ): Promise<UpdateReviewResponseDto> {
    return this.reviewApplicationService.updateReview(quizId, payload, user);
  }

  @Delete(':quizId/reviews')
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete my review',
    description: "Deletes the authenticated user's review for a quiz.",
  })
  @ApiOkResponse({ description: 'Review deleted', type: DeleteReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz or review not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteReview(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteReviewResponseDto> {
    return this.reviewApplicationService.deleteReview(quizId, user);
  }
}
