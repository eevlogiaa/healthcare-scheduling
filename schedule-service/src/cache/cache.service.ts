import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../config/env.validation';
import { CacheNamespace, REDIS_CLIENT } from './cache.constants';

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'scheduledAt']);

/** Reviver JSON.parse, balikin field timestamp jadi object Date lagi. */
export function reviveDates(key: string, value: unknown): unknown {
  return DATE_FIELDS.has(key) && typeof value === 'string' ? new Date(value) : value;
}

/**
 * Cache pake Redis. Kalo Redis lagi down, read dianggap miss dan write di-skip,
 * jadi service tetep jalan walau tanpa cache.
 *
 * Key-nya pake versi per namespace (`cache:<ns>:v<version>:<key>`). Invalidate cukup
 * naikin versinya, entry lama otomatis gak kepake lagi dan nanti expired via TTL.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlSeconds = config.get('CACHE_TTL_SECONDS', { infer: true });
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw, reviveDates) as T);
    } catch (error) {
      this.warn(`read of "${key}"`, error);
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.warn(`write of "${key}"`, error);
    }
  }

  /** Read-through: ambil dari cache, kalo gak ada baru load terus disimpen. */
  async wrap<T>(namespace: CacheNamespace, key: string, loader: () => Promise<T>): Promise<T> {
    if (this.ttlSeconds <= 0) return loader();

    // versi dibaca sebelum load, jadi kalo ada invalidate barengan,
    // data basi gak bakal nyangkut di versi yang baru
    const version = await this.namespaceVersion(namespace);
    if (version === undefined) return loader();

    const cacheKey = `cache:${namespace}:v${version}:${key}`;
    const cached = await this.get<T>(cacheKey);
    if (cached !== undefined) return cached;

    const value = await loader();
    if (value !== null && value !== undefined) {
      await this.set(cacheKey, value, this.ttlSeconds);
    }
    return value;
  }

  async invalidate(...namespaces: CacheNamespace[]): Promise<void> {
    if (this.ttlSeconds <= 0) return;
    try {
      await Promise.all(namespaces.map((namespace) => this.redis.incr(versionKey(namespace))));
    } catch (error) {
      this.warn(`invalidation of [${namespaces.join(', ')}]`, error);
    }
  }

  private async namespaceVersion(namespace: CacheNamespace): Promise<string | undefined> {
    try {
      return (await this.redis.get(versionKey(namespace))) ?? '0';
    } catch (error) {
      this.warn(`version lookup of "${namespace}"`, error);
      return undefined;
    }
  }

  private warn(operation: string, error: unknown): void {
    this.logger.warn(`Cache ${operation} skipped: ${(error as Error).message}`);
  }
}

function versionKey(namespace: CacheNamespace): string {
  return `cache:${namespace}:version`;
}
