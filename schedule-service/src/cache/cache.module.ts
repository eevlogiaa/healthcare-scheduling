import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../config/env.validation';
import { REDIS_CLIENT } from './cache.constants';
import { CacheService } from './cache.service';

function createRedisClient(config: ConfigService<EnvironmentVariables, true>): Redis {
  const logger = new Logger('Redis');
  const client = new Redis({
    host: config.get('REDIS_HOST', { infer: true }),
    port: config.get('REDIS_PORT', { infer: true }),
    password: config.get('REDIS_PASSWORD', { infer: true }) || undefined,
    // langsung gagal aja kalo Redis down, jangan diantriin. cache-nya opsional kok
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

  // log pas status koneksi berubah aja, biar gak spam tiap reconnect
  let healthy = true;
  client.on('ready', () => {
    if (!healthy) logger.log('Connection restored');
    healthy = true;
  });
  client.on('error', (error: Error) => {
    if (healthy) logger.warn(`Connection problem, caching is bypassed: ${error.message}`);
    healthy = false;
  });
  return client;
}

@Global()
@Module({
  providers: [
    { provide: REDIS_CLIENT, inject: [ConfigService], useFactory: createRedisClient },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
