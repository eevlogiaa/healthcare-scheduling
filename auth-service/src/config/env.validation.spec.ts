import 'reflect-metadata';
import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth_db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults and converts types', () => {
    const env = validateEnv({ ...base, PORT: '4000' });
    expect(env.PORT).toBe(4000);
    expect(env.JWT_EXPIRES_IN).toBe(3600);
    expect(env.BCRYPT_SALT_ROUNDS).toBe(10);
    expect(env.GRAPHQL_PLAYGROUND).toBe(true);
  });

  it('reads GRAPHQL_PLAYGROUND=false as false', () => {
    expect(validateEnv({ ...base, GRAPHQL_PLAYGROUND: 'false' }).GRAPHQL_PLAYGROUND).toBe(false);
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });
});
