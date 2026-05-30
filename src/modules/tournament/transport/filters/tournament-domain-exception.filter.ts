import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import {
  TournamentDomainError,
  TournamentNotFoundError,
  TournamentForbiddenError,
  TournamentConflictError,
  TournamentValidationError,
  TournamentRegistrationClosedError,
  TournamentFullError,
  TournamentAlreadyRegisteredError,
  TournamentRoundNotFoundError,
  TournamentRoundNotOpenError,
  TournamentAttemptAlreadyExistsError,
  TournamentNotRegisteredError,
  TournamentUnregisterClosedError,
  TournamentAlreadyWithdrawnError,
} from '../../domain/errors';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(TournamentDomainError)
export class TournamentDomainExceptionFilter implements ExceptionFilter {
  catch(exception: TournamentDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: HTTP_ERROR_NAMES[status] ?? 'Error',
    });
  }

  private mapToHttp(error: TournamentDomainError): { status: number; message: string } {
    if (error instanceof TournamentNotFoundError || error instanceof TournamentNotRegisteredError) {
      return { status: HttpStatus.NOT_FOUND, message: error.message };
    }

    if (error instanceof TournamentRoundNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Tournament round not found' };
    }

    if (error instanceof TournamentForbiddenError) {
      return {
        status: HttpStatus.FORBIDDEN,
        message: 'You do not have permission to perform this action',
      };
    }

    if (
      error instanceof TournamentConflictError ||
      error instanceof TournamentAlreadyRegisteredError ||
      error instanceof TournamentAttemptAlreadyExistsError ||
      error instanceof TournamentAlreadyWithdrawnError
    ) {
      return { status: HttpStatus.CONFLICT, message: error.message };
    }

    if (
      error instanceof TournamentRegistrationClosedError ||
      error instanceof TournamentFullError ||
      error instanceof TournamentValidationError ||
      error instanceof TournamentRoundNotOpenError ||
      error instanceof TournamentUnregisterClosedError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: error.message };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
