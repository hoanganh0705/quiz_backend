import { Body, Controller, Get, Patch, UseFilters } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UpdateMeSettingsDto } from './dto/request/update-me-settings.dto';
import { UpdateMeDto } from './dto/request/update-me.dto';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { UserApplicationService } from './application/user.application.service';
import { UserDomainExceptionFilter } from './transport/filters/user-domain-exception.filter';

@ApiTags('users')
@ApiBearerAuth()
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
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userApplicationService.getMe(userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update profile',
    description: "Updates the authenticated user's display name, bio, or avatar URL.",
  })
  @ApiOkResponse({ description: 'Profile updated', type: UserMeResponseDto })
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
  updateMeSettings(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    return this.userApplicationService.updateSettings(userId, payload);
  }
}
