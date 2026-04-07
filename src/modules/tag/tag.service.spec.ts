import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../../core/database/database.module';
import { TagService } from './tag.service';

describe('TagService', () => {
  let service: TagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: DRIZZLE,
          useValue: {
            select: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
