import { Injectable } from '@nestjs/common';
import type {
  LoginResult,
  RefreshTokenResult,
  RegisterResult,
  VerifyEmailResult,
  CurrentUserResult,
  CredentialVerificationResult,
  AvailabilityResult,
  AccountDeletionResult,
} from '../types/auth-result.types';
import { LoginResponseDto } from '../dto/response/login-response.dto';
import { RefreshTokenResponseDto } from '../dto/response/refresh-token-response.dto';
import { LogoutResponseDto } from '../dto/response/logout-response.dto';
import { ChangePasswordResponseDto } from '../dto/response/change-password-response.dto';
import { RegisterResponseDto } from '../dto/response/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/response/verify-email-response.dto';
import { CurrentUserResponseDto } from '../dto/response/current-user-response.dto';
import { VerifyPasswordResponseDto } from '../dto/response/verify-password-response.dto';
import { CheckEmailResponseDto } from '../dto/response/check-email-response.dto';
import { CheckUsernameResponseDto } from '../dto/response/check-username-response.dto';
import { DeleteAccountResponseDto } from '../dto/response/delete-account-response.dto';

@Injectable()
export class AuthResponseMapper {
  toLoginResponse(result: LoginResult): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.userId = result.userId;
    dto.username = result.username;
    dto.email = result.email;
    dto.accessToken = result.accessToken;
    dto.sessionId = result.sessionId;
    return dto;
  }

  toRefreshTokenResponse(result: RefreshTokenResult): RefreshTokenResponseDto {
    const dto = new RefreshTokenResponseDto();
    dto.accessToken = result.accessToken;
    return dto;
  }

  toLogoutResponse(message: string): LogoutResponseDto {
    const dto = new LogoutResponseDto();
    dto.message = message;
    return dto;
  }

  toChangePasswordResponse(message: string): ChangePasswordResponseDto {
    const dto = new ChangePasswordResponseDto();
    dto.message = message;
    return dto;
  }

  toRegisterResponse(result: RegisterResult): RegisterResponseDto {
    const dto = new RegisterResponseDto();
    dto.message = result.message;
    return dto;
  }

  toVerifyEmailResponse(result: VerifyEmailResult): VerifyEmailResponseDto {
    const dto = new VerifyEmailResponseDto();
    dto.message = result.message;
    return dto;
  }

  toCurrentUserResponse(result: CurrentUserResult): CurrentUserResponseDto {
    const dto = new CurrentUserResponseDto();
    dto.userId = result.userId;
    dto.username = result.username;
    dto.email = result.email;
    dto.role = result.role;
    dto.isVerified = result.isVerified;
    return dto;
  }

  toVerifyPasswordResponse(result: CredentialVerificationResult): VerifyPasswordResponseDto {
    const dto = new VerifyPasswordResponseDto();
    dto.valid = result.valid;
    return dto;
  }

  toCheckEmailResponse(result: AvailabilityResult): CheckEmailResponseDto {
    const dto = new CheckEmailResponseDto();
    dto.available = result.available;
    return dto;
  }

  toCheckUsernameResponse(result: AvailabilityResult): CheckUsernameResponseDto {
    const dto = new CheckUsernameResponseDto();
    dto.available = result.available;
    return dto;
  }

  toDeleteAccountResponse(result: AccountDeletionResult): DeleteAccountResponseDto {
    const dto = new DeleteAccountResponseDto();
    dto.message = result.message;
    return dto;
  }
}
