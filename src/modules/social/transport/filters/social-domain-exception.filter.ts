import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  SocialError,
  FriendRequestNotFoundError,
  FriendRequestForbiddenError,
  SelfFriendRequestError,
  AlreadyFriendsError,
  BlockedUserError,
  UserBlockedError,
  PendingRequestExistsError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(SocialError)
export class SocialDomainExceptionFilter implements ExceptionFilter {
  catch(exception: SocialError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: SocialError): { status: number; message: string } {
    if (error instanceof FriendRequestNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Friend request not found' };
    }

    if (error instanceof FriendRequestForbiddenError) {
      return {
        status: HttpStatus.FORBIDDEN,
        message: 'You do not have permission to perform this action',
      };
    }

    if (error instanceof SelfFriendRequestError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'You cannot send a friend request to yourself' };
    }

    if (error instanceof AlreadyFriendsError) {
      return { status: HttpStatus.CONFLICT, message: 'You are already friends with this user' };
    }

    if (error instanceof BlockedUserError) {
      return { status: HttpStatus.FORBIDDEN, message: 'Cannot perform this action on a blocked user' };
    }

    if (error instanceof UserBlockedError) {
      return { status: HttpStatus.FORBIDDEN, message: 'This user has blocked you' };
    }

    if (error instanceof PendingRequestExistsError) {
      return { status: HttpStatus.CONFLICT, message: 'A friend request is already pending' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
