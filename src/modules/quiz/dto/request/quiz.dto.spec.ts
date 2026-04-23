import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuizDto } from './create-quiz.dto';

describe('Quiz DTOs', () => {
  it('normalizes create quiz text fields and slug', async () => {
    const dto = plainToInstance(CreateQuizDto, {
      title: ' Science Quiz ',
      description: '   ',
      slug: ' Space-Facts ',
      requirements: '',
      imageUrl: ' ',
      initialVersion: {
        difficulty: 'easy',
        durationMs: 60_000,
        passingScorePercent: 70,
        rewardXp: 10,
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      title: 'Science Quiz',
      description: null,
      slug: 'space-facts',
      requirements: null,
      imageUrl: null,
    });
  });

  it('rejects invalid quiz slugs', async () => {
    const dto = plainToInstance(CreateQuizDto, {
      title: 'Science Quiz',
      slug: 'not valid',
      initialVersion: {
        difficulty: 'easy',
        durationMs: 60_000,
        passingScorePercent: 70,
        rewardXp: 10,
      },
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'slug')).toBe(true);
  });
});
