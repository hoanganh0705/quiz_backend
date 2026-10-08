import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuizDto } from './create-quiz.dto';
import { UpdateQuizDto } from './update-quiz.dto';
import { AdminUpdateQuizDto } from './admin-update-quiz.dto';

const TITLE_OK = 'JavaScript Fundamentals';

describe('CreateQuizDto', () => {
  it('does not accept isFeatured from a non-admin caller', async () => {
    const payload = plainToInstance(
      CreateQuizDto,
      {
        title: TITLE_OK,
        initialVersion: {
          difficulty: 'medium',
          durationMs: 600000,
          passingScorePercent: 70,
          rewardXp: 100,
        },
        isFeatured: true,
        isHidden: true,
      },
      { enableImplicitConversion: false },
    );

    await validate(payload, { whitelist: true });

    expect(payload).not.toHaveProperty('isFeatured');
    expect(payload).not.toHaveProperty('isHidden');
  });

  it('still validates a well-formed payload without privileged fields', async () => {
    const payload = plainToInstance(
      CreateQuizDto,
      {
        title: TITLE_OK,
        initialVersion: {
          difficulty: 'medium',
          durationMs: 600000,
          passingScorePercent: 70,
          rewardXp: 100,
        },
      },
      { enableImplicitConversion: false },
    );
    const errors = await validate(payload, { whitelist: true });
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateQuizDto', () => {
  it('does not accept isFeatured or isHidden from a non-admin caller', async () => {
    const payload = plainToInstance(
      UpdateQuizDto,
      {
        title: 'Updated title',
        isFeatured: true,
        isHidden: true,
      },
      { enableImplicitConversion: false },
    );

    await validate(payload, { whitelist: true });

    expect(payload).not.toHaveProperty('isFeatured');
    expect(payload).not.toHaveProperty('isHidden');
  });
});

describe('AdminUpdateQuizDto', () => {
  it('accepts isFeatured and isHidden for admin callers', async () => {
    const payload = plainToInstance(
      AdminUpdateQuizDto,
      {
        isFeatured: true,
        isHidden: false,
      },
      { enableImplicitConversion: false },
    );

    expect(payload.isFeatured).toBe(true);
    expect(payload.isHidden).toBe(false);
    const errors = await validate(payload);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-boolean values for isFeatured', async () => {
    const payload = plainToInstance(
      AdminUpdateQuizDto,
      {
        isFeatured: 'true',
      },
      { enableImplicitConversion: false },
    );

    const errors = await validate(payload);
    const featuredError = errors.find((e) => e.property === 'isFeatured');
    expect(featuredError).toBeDefined();
  });
});
