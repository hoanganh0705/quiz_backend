import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  InstanceDomainError,
  InstanceNotFoundError,
  InstanceForbiddenError,
  InstanceConflictError,
  InstanceValidationError,
  InstanceNotOpenError,
  InstanceNotHostError,
  InstanceAlreadyStartedError,
  InstanceAlreadyClosedError,
  InstanceFullError,
  PlayerAlreadyJoinedError,
  PlayerNotInInstanceError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(InstanceDomainError)
export class InstanceDomainExceptionFilter implements ExceptionFilter {
  catch(exception: InstanceDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: InstanceDomainError): { status: number; message: string } {
    if (
      error instanceof InstanceNotFoundError ||
      error instanceof PlayerNotInInstanceError
    ) {
      return { status: HttpStatus.NOT_FOUND, message: error.message };
    }

    if (
      error instanceof InstanceForbiddenError ||
      error instanceof InstanceNotHostError
    ) {
      return { status: HttpStatus.FORBIDDEN, message: error.message };
    }

    if (
      error instanceof InstanceConflictError ||
      error instanceof PlayerAlreadyJoinedError
    ) {
      return { status: HttpStatus.CONFLICT, message: error.message };
    }

    if (
      error instanceof InstanceNotOpenError ||
      error instanceof InstanceFullError ||
      error instanceof InstanceValidationError ||
      error instanceof InstanceAlreadyStartedError ||
      error instanceof InstanceAlreadyClosedError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: error.message };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: error.message };
  }
}
