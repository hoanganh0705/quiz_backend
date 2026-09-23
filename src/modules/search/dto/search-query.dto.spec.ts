import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

async function validateDto(payload: Record<string, unknown>): Promise<SearchQueryDto> {
  const instance = plainToInstance(SearchQueryDto, payload);
  const errors = await validate(instance);
  return { instance, errors } as never;
}

function getProps(result: Awaited<ReturnType<typeof validateDto>>): {
  instance: SearchQueryDto;
  errors: unknown[];
} {
  return result as unknown as { instance: SearchQueryDto; errors: unknown[] };
}

describe('SearchQueryDto', () => {
  it('accepts a well-formed query with explicit limit', async () => {
    const { instance, errors } = getProps(await validateDto({ q: 'nestjs advanced', limit: 15 }));

    expect(errors).toEqual([]);
    expect(instance.q).toBe('nestjs advanced');
    expect(instance.limit).toBe(15);
  });

  it('applies the default limit when omitted', async () => {
    const { instance, errors } = getProps(await validateDto({ q: 'typescript' }));

    expect(errors).toEqual([]);
    expect(instance.limit).toBe(10);
  });

  it('normalises whitespace, trims, and lowercases the query', async () => {
    const { instance, errors } = getProps(await validateDto({ q: '   NestJS   Advanced  ' }));

    expect(errors).toEqual([]);
    expect(instance.q).toBe('nestjs advanced');
  });

  it('rejects a query shorter than 2 chars', async () => {
    const { errors } = getProps(await validateDto({ q: 'a', limit: 5 }));

    expect(errors).not.toEqual([]);
    expect(String(errors)).toMatch(/q/);
  });

  it('rejects an empty query', async () => {
    const { errors } = getProps(await validateDto({ q: '' }));

    expect(errors).not.toEqual([]);
  });

  it('rejects a non-string query', async () => {
    const { errors } = getProps(await validateDto({ q: 12345, limit: 5 }));

    expect(errors).not.toEqual([]);
  });

  it('rejects a limit below 1', async () => {
    const { errors } = getProps(await validateDto({ q: 'abc', limit: 0 }));

    expect(errors).not.toEqual([]);
  });

  it('rejects a limit above 20', async () => {
    const { errors } = getProps(await validateDto({ q: 'abc', limit: 25 }));

    expect(errors).not.toEqual([]);
  });

  it('rejects a non-integer limit', async () => {
    const { errors } = getProps(await validateDto({ q: 'abc', limit: 'ten' }));

    expect(errors).not.toEqual([]);
  });
});
