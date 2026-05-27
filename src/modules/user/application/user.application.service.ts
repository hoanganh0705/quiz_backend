import { Injectable } from '@nestjs/common';
import { UserDomainService } from '../domain/user.service';
import { UserResponseMapper } from '../mappers/user-response.mapper';
import { UpdateMeDto } from '../dto/request/update-me.dto';
import { UpdateMeSettingsDto } from '../dto/request/update-me-settings.dto';
import type { UserMeResponseDto } from '../dto/response/user-me-response.dto';

@Injectable()
export class UserApplicationService {
  constructor(private readonly userDomainService: UserDomainService) {}

  async getMe(userId: string): Promise<UserMeResponseDto> {
    const row = await this.userDomainService.getMe(userId);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async updateProfile(userId: string, payload: UpdateMeDto): Promise<UserMeResponseDto> {
    const row = await this.userDomainService.updateProfile(userId, payload);
    return UserResponseMapper.toUserMeResponse(row);
  }

  async updateSettings(userId: string, payload: UpdateMeSettingsDto): Promise<UserMeResponseDto> {
    const row = await this.userDomainService.updateSettings(userId, payload);
    return UserResponseMapper.toUserMeResponse(row);
  }
}
