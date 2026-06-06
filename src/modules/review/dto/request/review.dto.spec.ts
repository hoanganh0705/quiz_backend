/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListReviewsQueryDto } from './index';

describe('Review request DTOs', () => {
  it('accepts a valid rating filter', async () => {
    const dto = plainToInstance(ListReviewsQueryDto, { rating: '5', limit: '20' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.rating).toBe(5);
  });

  it('rejects rating lower than 1', async () => {
    const dto = plainToInstance(ListReviewsQueryDto, { rating: '0' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('rating');
  });

  it('rejects rating greater than 5', async () => {
    const dto = plainToInstance(ListReviewsQueryDto, { rating: '6' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('rating');
  });
});
