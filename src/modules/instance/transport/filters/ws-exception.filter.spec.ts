import { ArgumentsHost, UnauthorizedException, HttpException } from '@nestjs/common';
import { WsExceptionFilter } from './ws-exception.filter';
import { BaseDomainException } from '@/common/errors/base-domain.exception';

class TestDomainError extends BaseDomainException {
  readonly code = 'TEST_ERROR';
  constructor() {
    super('Test error message');
  }
}

describe('WsExceptionFilter', () => {
  let filter: WsExceptionFilter;
  let mockClient: { emit: jest.Mock };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockClient = { emit: jest.fn() };
    mockHost = {
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
        getData: jest.fn().mockReturnValue({}),
      }),
    } as unknown as ArgumentsHost;

    filter = new WsExceptionFilter({
      warn: jest.fn(),
      error: jest.fn(),
    } as never);
  });

  describe('UnauthorizedException', () => {
    it('emits UNAUTHORIZED error', () => {
      filter.catch(new UnauthorizedException(), mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    });
  });

  describe('BaseDomainException', () => {
    it('emits domain error code and message', () => {
      filter.catch(new TestDomainError(), mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        code: 'TEST_ERROR',
        message: 'Test error message',
      });
    });
  });

  describe('HttpException', () => {
    it('emits HTTP error with status code', () => {
      filter.catch(new HttpException('Bad Request', 400), mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        code: 'HTTP_400',
        message: 'Bad Request',
      });
    });

    it('extracts message from object response', () => {
      filter.catch(new HttpException({ message: 'Validation failed' }, 422), mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        code: 'HTTP_422',
        message: 'Validation failed',
      });
    });
  });

  describe('unhandled errors', () => {
    it('emits INTERNAL_ERROR for unknown exceptions', () => {
      filter.catch(new Error('Something went wrong'), mockHost);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    });
  });
});
