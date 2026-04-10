import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateMeSettingsDto } from './dto/request/update-me-settings.dto';
import { UpdateMeDto } from './dto/request/update-me.dto';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userService.getMeById(userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeDto,
  ): Promise<UserMeResponseDto> {
    return this.userService.updateMeById(userId, payload);
  }

  @Patch('me/settings')
  updateMeSettings(
    @CurrentUser('sub') userId: string,
    @Body() payload: UpdateMeSettingsDto,
  ): Promise<UserMeResponseDto> {
    return this.userService.updateMeSettingsById(userId, payload);
  }
}
