import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';
import { UpdateCategoryDto } from './update-category.dto';

describe('Category DTOs', () => {
  it('normalizes blank nullable fields on create payloads', async () => {
    const dto = plainToInstance(CreateCategoryDto, {
      name: ' Science ',
      description: '   ',
      imageUrl: '',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      name: 'Science',
      description: null,
      imageUrl: null,
    });
  });

  it('normalizes blank nullable fields on update payloads', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      description: '',
      imageUrl: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      description: null,
      imageUrl: null,
    });
  });

  it('rejects invalid category slugs', async () => {
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Science',
      slug: 'Not Valid',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('slug');
  });
});
