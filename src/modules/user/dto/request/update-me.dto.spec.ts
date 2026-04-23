import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeDto } from './update-me.dto';

describe('UpdateMeDto', () => {
  it('normalizes blank nullable profile fields', async () => {
    const dto = plainToInstance(UpdateMeDto, {
      displayName: '   ',
      bio: '',
      avatarUrl: '  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      displayName: null,
      bio: null,
      avatarUrl: null,
    });
  });
});
