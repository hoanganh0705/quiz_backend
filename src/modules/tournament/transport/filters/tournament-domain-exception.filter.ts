import { Catch, HttpStatus, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
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
  TournamentParticipantStateError,
  TournamentWithdrawClosedError,
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
  constructor(
    @InjectPinoLogger(TournamentDomainExceptionFilter.name) private readonly logger: PinoLogger,
  ) {}

  catch(exception: TournamentDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.mapToHttp(exception);

    if (status >= 500) {
      this.logger.error({
        event: 'tournament_domain_exception_unexpected',
        statusCode: status,
        errorName: exception.name,
        message,
        method: request.method,
        url: request.url,
        stack: exception.stack,
      });
    } else {
      this.logger.warn({
        event: 'tournament_domain_exception',
        statusCode: status,
        errorName: exception.name,
        message,
        method: request.method,
        url: request.url,
      });
    }

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
      error instanceof TournamentParticipantStateError
    ) {
      return { status: HttpStatus.CONFLICT, message: error.message };
    }

    if (
      error instanceof TournamentRegistrationClosedError ||
      error instanceof TournamentFullError ||
      error instanceof TournamentValidationError ||
      error instanceof TournamentRoundNotOpenError ||
      error instanceof TournamentUnregisterClosedError ||
      error instanceof TournamentWithdrawClosedError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: error.message };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
