import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  InstanceDomainError,
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  InstanceFullError,
  InstanceAlreadyStartedError,
  InstanceAlreadyClosedError,
  PlayerAlreadyJoinedError,
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
    if (error instanceof InstanceNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
    }

    if (error instanceof InstanceNotHostError) {
      return {
        status: HttpStatus.FORBIDDEN,
        message: 'You do not have permission to perform this action',
      };
    }

    if (error instanceof PlayerAlreadyJoinedError) {
      return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
    }

    if (
      error instanceof InstanceNotOpenError ||
      error instanceof InstanceFullError ||
      error instanceof InstanceAlreadyStartedError ||
      error instanceof InstanceAlreadyClosedError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request data' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
