import { Prisma } from '@prisma/client';

/** Kena unique constraint. */
export const PRISMA_UNIQUE_VIOLATION = 'P2002';

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
