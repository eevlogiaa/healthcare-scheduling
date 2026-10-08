import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('applies defaults and converts string values', () => {
    const env = validateEnv({ SMTP_PORT: '2525', SMTP_SECURE: 'false', REDIS_PORT: '6380' });
    expect(env).toMatchObject({
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6380,
      SMTP_PORT: 2525,
      SMTP_SECURE: false,
      APP_TIMEZONE: 'Asia/Jakarta',
      QUEUE_CONCURRENCY: 5,
    });
  });

  it('reads SMTP_SECURE=true as true', () => {
    expect(validateEnv({ SMTP_SECURE: 'true' }).SMTP_SECURE).toBe(true);
  });

  it('rejects an unknown time zone', () => {
    expect(() => validateEnv({ APP_TIMEZONE: 'Mars/Olympus' })).toThrow(/APP_TIMEZONE/);
  });

  it('rejects an invalid port', () => {
    expect(() => validateEnv({ SMTP_PORT: '70000' })).toThrow(/SMTP_PORT/);
  });
});
