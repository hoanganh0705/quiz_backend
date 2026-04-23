import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '@/core/database/database.module';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
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
        CategoryService,
        {
          provide: DRIZZLE,
          useValue: dbMock,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds a slug and normalizes blank nullable fields when creating a category', async () => {
    returningMock.mockResolvedValueOnce([
      {
        categoryId: '5d096492-62fb-4f97-8937-5f07c5f10ad8',
        name: 'Science Facts',
        description: null,
        slug: 'science-facts',
        imageUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await expect(
      service.createCategory({
        name: ' Science Facts ',
        description: '   ',
        imageUrl: '',
      }),
    ).resolves.toMatchObject({
      name: 'Science Facts',
      description: null,
      slug: 'science-facts',
      imageUrl: null,
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Science Facts',
        slug: 'science-facts',
        description: null,
        imageUrl: null,
      }),
    );
  });
});
