import { ValidateIf } from 'class-validator';

/**
 * Mirip `@IsOptional()`, tapi yang di-skip cuma field yang gak dikirim.
 * `null` eksplisit tetep divalidasi (dan ditolak) biar gak nyampe ke DB.
 */
export const IsDefinedOrAbsent = () => ValidateIf((_object, value) => value !== undefined);
