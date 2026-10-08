import { Prisma } from '@prisma/client';
import { CacheNamespace } from '../cache/cache.constants';

export function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: 'test',
  });
}

/** Cache yang gak pernah hit, `wrap` langsung manggil loader. */
export function passThroughCache() {
  return {
    wrap: jest.fn((_namespace: CacheNamespace, _key: string, loader: () => Promise<unknown>) =>
      loader(),
    ),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
}
