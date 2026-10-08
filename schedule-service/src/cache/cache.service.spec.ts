import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CacheNamespace, REDIS_CLIENT } from './cache.constants';
import { CacheService, reviveDates } from './cache.service';

/** Fake ioredis in-memory, isinya cuma command yang dipake cache. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    incr: jest.fn((key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return Promise.resolve(next);
    }),
  };
}

async function createService(redis: ReturnType<typeof fakeRedis>, ttl = 60): Promise<CacheService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CacheService,
      { provide: REDIS_CLIENT, useValue: redis },
      { provide: ConfigService, useValue: new ConfigService({ CACHE_TTL_SECONDS: ttl }) },
    ],
  }).compile();
  return moduleRef.get(CacheService);
}

describe('CacheService', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it('revives timestamp fields as Date objects', () => {
    const parsed = JSON.parse(
      '{"name":"x","createdAt":"2030-01-01T00:00:00.000Z","nested":{"scheduledAt":"2030-01-02T00:00:00.000Z"}}',
      reviveDates,
    );
    expect(parsed.createdAt).toEqual(new Date('2030-01-01T00:00:00.000Z'));
    expect(parsed.nested.scheduledAt).toBeInstanceOf(Date);
    expect(parsed.name).toBe('x');
  });

  it('stores values with a TTL and reads them back', async () => {
    const redis = fakeRedis();
    const cache = await createService(redis);

    await cache.set('key', { a: 1 }, 30);

    expect(redis.set).toHaveBeenCalledWith('key', '{"a":1}', 'EX', 30);
    await expect(cache.get('key')).resolves.toEqual({ a: 1 });
    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('does not store anything for a TTL of 0', async () => {
    const redis = fakeRedis();
    const cache = await createService(redis);
    await cache.set('key', 1, 0);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('wrap loads once and then serves from the cache', async () => {
    const cache = await createService(fakeRedis());
    const loader = jest.fn().mockResolvedValue({ id: 1, createdAt: new Date('2030-01-01') });

    const first = await cache.wrap(CacheNamespace.Doctors, 'id:1', loader);
    const second = await cache.wrap<{ createdAt: Date }>(CacheNamespace.Doctors, 'id:1', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second.createdAt).toBeInstanceOf(Date);
  });

  it('wrap does not cache null results', async () => {
    const cache = await createService(fakeRedis());
    const loader = jest.fn().mockResolvedValue(null);

    await cache.wrap(CacheNamespace.Doctors, 'id:1', loader);
    await cache.wrap(CacheNamespace.Doctors, 'id:1', loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidate makes every entry of the namespace stale', async () => {
    const cache = await createService(fakeRedis());
    const loader = jest.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');

    await cache.wrap(CacheNamespace.Customers, 'list:1:10', loader);
    await cache.invalidate(CacheNamespace.Customers);

    await expect(cache.wrap(CacheNamespace.Customers, 'list:1:10', loader)).resolves.toBe('new');
  });

  it('invalidating one namespace leaves the others cached', async () => {
    const cache = await createService(fakeRedis());
    const loader = jest.fn().mockResolvedValue('value');

    await cache.wrap(CacheNamespace.Doctors, 'k', loader);
    await cache.invalidate(CacheNamespace.Customers);
    await cache.wrap(CacheNamespace.Doctors, 'k', loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache entirely when the TTL is 0', async () => {
    const redis = fakeRedis();
    const cache = await createService(redis, 0);
    const loader = jest.fn().mockResolvedValue('value');

    await cache.wrap(CacheNamespace.Doctors, 'k', loader);
    await cache.invalidate(CacheNamespace.Doctors);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('keeps working when Redis is down', async () => {
    const redis = fakeRedis();
    const down = new Error('connect ECONNREFUSED');
    redis.get.mockRejectedValue(down);
    redis.set.mockRejectedValue(down);
    redis.incr.mockRejectedValue(down);
    const cache = await createService(redis);
    const loader = jest.fn().mockResolvedValue('fresh');

    await expect(cache.wrap(CacheNamespace.Doctors, 'k', loader)).resolves.toBe('fresh');
    await expect(cache.get('k')).resolves.toBeUndefined();
    await expect(cache.set('k', 1, 10)).resolves.toBeUndefined();
    await expect(cache.invalidate(CacheNamespace.Doctors)).resolves.toBeUndefined();
  });
});
