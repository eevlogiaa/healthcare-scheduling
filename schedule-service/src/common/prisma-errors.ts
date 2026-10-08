import { Prisma } from '@prisma/client';

/** Kena unique constraint. */
export const PRISMA_UNIQUE_VIOLATION = 'P2002';
/** Kena foreign key, misal hapus data yang masih dipake tabel lain. */
export const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';
/** Data yang mau di-update/delete gak ada. */
export const PRISMA_RECORD_NOT_FOUND = 'P2025';

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
