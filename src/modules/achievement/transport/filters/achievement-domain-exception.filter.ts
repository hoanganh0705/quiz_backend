import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { UserProfilePrivateError } from '@/modules/user/domain/errors';
import {
  AchievementDomainError,
  AchievementUserNotFoundError,
  BadgeNotFoundError,
  UserBadgeOwnershipNotFoundError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(AchievementDomainError, UserProfilePrivateError)
export class AchievementDomainExceptionFilter implements ExceptionFilter {
  catch(exception: AchievementDomainError | UserProfilePrivateError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(
    error: AchievementDomainError | UserProfilePrivateError,
  ): { status: number; message: string } {
    if (error instanceof BadgeNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Badge not found' };
    }

    if (error instanceof AchievementUserNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'User not found' };
    }

    if (error instanceof UserBadgeOwnershipNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'User badge not found' };
    }

    if (error instanceof UserProfilePrivateError) {
      return { status: HttpStatus.FORBIDDEN, message: error.message };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
