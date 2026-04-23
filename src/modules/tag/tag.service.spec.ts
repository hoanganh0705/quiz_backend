import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '@/core/database/database.module';
import { TagService } from './tag.service';

describe('TagService', () => {
  let service: TagService;
  const returningMock = jest.fn();
  const valuesMock = jest.fn(() => ({
    returning: returningMock,
  }));
  const dbMock = {
    select: jest.fn(),
    insert: jest.fn(() => ({
      values: valuesMock,
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: DRIZZLE,
          useValue: dbMock,
        },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds a slug from the name when creating a tag', async () => {
    returningMock.mockResolvedValueOnce([
      {
        tagId: '5d096492-62fb-4f97-8937-5f07c5f10ad8',
        name: 'Science Facts',
        slug: 'science-facts',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await expect(service.createTag({ name: ' Science Facts ' })).resolves.toMatchObject({
      name: 'Science Facts',
      slug: 'science-facts',
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Science Facts',
        slug: 'science-facts',
      }),
    );
  });
});
