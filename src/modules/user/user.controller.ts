import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { UserMeResponseDto } from './dto/response/user-me-response.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser('sub') userId: string): Promise<UserMeResponseDto> {
    return this.userService.getMeById(userId);
  }
}
