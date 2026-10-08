import { TransformFnParams } from 'class-transformer';

/** Email di-trim + lowercase biar cek unique-nya gak case-sensitive. */
export function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
