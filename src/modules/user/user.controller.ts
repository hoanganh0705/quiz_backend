import { Body, Controller, Get, Patch, Query, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { ListUserActivityQueryDto } from './dto/request/list-user-activity-query.dto';
import { UpdateMeSettingsDto } from './dto/request/update-me-settings.dto';
import { UpdateMeDto } from './dto/request/update-me.dto';
import { UserActivityResponseDto } from './dto/response/user-activity-response.dto';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { UserApplicationService } from './application/user.application.service';
import { UserActivityCursorMapper } from './mappers/user-activity-cursor.mapper';
import { UserDomainExceptionFilter } from './transport/filters/user-domain-exception.filter';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid authentication token' })
@ApiForbiddenResponse({ description: 'Authenticated user lacks required role or permission' })
@Controller('users')
@UseFilters(UserDomainExceptionFilter)
export class UserController {
  constructor(private readonly userApplicationService: UserApplicationService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      "Returns the authenticated user's full profile including XP, streaks, and settings.",
  })
  @ApiOkResponse({ description: 'Profile returned', type: UserMeResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userApplicationService.getMe(userId);
  }

  @Get('me/activity')
  @ApiOperation({
    summary: 'My activity',
    description:
      "Returns the authenticated user's activity events, cursor-paginated and ordered by most recent activity.",
  })
  @ApiOkResponse({ description: 'Activity returned', type: UserActivityResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listUserActivity(
    @CurrentUser('sub') userId: string,
    @Query() query: ListUserActivityQueryDto,
  ): Promise<UserActivityResponseDto> {
    const cursor = query.cursor ? UserActivityCursorMapper.parse(query.cursor) : null;

    return this.userApplicationService.listUserActivity(userId, {
      limit: query.limit,
      cursor,
    });
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update profile',
    description: "Updates the authenticated user's display name, bio, or avatar URL.",
  })
  @ApiOkResponse({ description: 'Profile updated', type: UserMeResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateProfile(userId, payload);
  }

  @Patch('me/settings')
  @ApiOperation({
    summary: 'Update settings',
    description: "Replaces the authenticated user's entire settings object.",
  })
  @ApiOkResponse({ description: 'Settings updated', type: UserMeResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateMeSettings(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateSettings(userId, payload);
  }
}
