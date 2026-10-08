import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { validateEnv } from '../config/env.validation';
import { CreateCustomerInput } from '../customers/dto/create-customer.input';
import { UpdateCustomerInput } from '../customers/dto/update-customer.input';
import { CreateScheduleInput } from '../schedules/dto/create-schedule.input';
import { PaginationArgs } from './dto/pagination.args';
import { toPage, toSkip } from './models/paginated.model';

function errorsOf<T extends object>(type: new () => T, plain: object): string[] {
  return validateSync(plainToInstance(type, plain)).map((error) => error.property);
}

describe('pagination helpers', () => {
  it('computes the offset', () => {
    expect(toSkip({ page: 1, limit: 10 })).toBe(0);
    expect(toSkip({ page: 3, limit: 25 })).toBe(50);
  });

  it('builds page metadata', () => {
    expect(toPage([], 0, { page: 1, limit: 10 }).pageInfo).toEqual({
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(toPage([1], 30, { page: 3, limit: 10 }).pageInfo).toMatchObject({
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('rejects out-of-range pagination arguments', () => {
    expect(errorsOf(PaginationArgs, { page: 0, limit: 101 }).sort()).toEqual(['limit', 'page']);
    expect(errorsOf(PaginationArgs, {})).toEqual([]);
  });
});

describe('input validation', () => {
  it('normalises customer input', () => {
    const input = plainToInstance(CreateCustomerInput, {
      name: '  Jane Doe ',
      email: ' JANE@Example.com ',
    });
    expect(input).toEqual({ name: 'Jane Doe', email: 'jane@example.com' });
    expect(validateSync(input)).toHaveLength(0);
  });

  it('rejects a blank name and an invalid email', () => {
    expect(errorsOf(CreateCustomerInput, { name: '   ', email: 'nope' }).sort()).toEqual([
      'email',
      'name',
    ]);
  });

  it('allows partial updates but rejects explicit nulls', () => {
    expect(errorsOf(UpdateCustomerInput, {})).toEqual([]);
    expect(errorsOf(UpdateCustomerInput, { name: 'New name' })).toEqual([]);
    expect(errorsOf(UpdateCustomerInput, { name: null, email: null }).sort()).toEqual([
      'email',
      'name',
    ]);
  });

  it('validates schedule input', () => {
    expect(
      errorsOf(CreateScheduleInput, {
        objective: '',
        customerId: 'not-a-uuid',
        doctorId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
        scheduledAt: new Date('2030-01-01T09:00:00Z'),
      }).sort(),
    ).toEqual(['customerId', 'objective']);
  });
});

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/schedule_db',
    AUTH_SERVICE_URL: 'http://auth-service:3001',
  };

  it('converts string values and applies defaults', () => {
    const env = validateEnv({
      ...base,
      PORT: '4002',
      REDIS_PORT: '6380',
      GRAPHQL_PLAYGROUND: 'false',
    });
    expect(env).toMatchObject({
      PORT: 4002,
      REDIS_PORT: 6380,
      REDIS_HOST: 'localhost',
      CACHE_TTL_SECONDS: 60,
      SCHEDULE_DURATION_MINUTES: 30,
      GRAPHQL_PLAYGROUND: false,
    });
  });

  it('rejects a missing or invalid Auth Service URL', () => {
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/AUTH_SERVICE_URL/);
    expect(() => validateEnv({ ...base, AUTH_SERVICE_URL: 'auth-service' })).toThrow(
      /AUTH_SERVICE_URL/,
    );
  });
});
