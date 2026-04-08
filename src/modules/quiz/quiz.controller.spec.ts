import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getLoggerToken } from 'nestjs-pino';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

describe('QuizController', () => {
  let controller: QuizController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: QuizService,
          useValue: {
            createQuiz: jest.fn(),
            listQuizzes: jest.fn(),
            getQuizBySlug: jest.fn(),
            createQuizVersion: jest.fn(),
            listQuizVersions: jest.fn(),
          },
        },
        {
          provide: getLoggerToken('RolesGuard'),
          useValue: {
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<QuizController>(QuizController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
