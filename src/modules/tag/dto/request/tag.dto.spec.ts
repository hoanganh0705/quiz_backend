import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTagDto } from './create-tag.dto';
import { UpdateTagDto } from './update-tag.dto';

describe('Tag DTOs', () => {
  it('normalizes create payload name and slug', async () => {
    const dto = plainToInstance(CreateTagDto, {
      name: ' Science ',
      slug: ' Space-Facts ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      name: 'Science',
      slug: 'space-facts',
    });
  });

  it('normalizes update payload name and slug', async () => {
    const dto = plainToInstance(UpdateTagDto, {
      name: ' Math ',
      slug: ' Algebra ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      name: 'Math',
      slug: 'algebra',
    });
  });

  it('rejects invalid tag slugs', async () => {
    const dto = plainToInstance(CreateTagDto, {
      name: 'Science',
      slug: 'not valid',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('slug');
  });
});
