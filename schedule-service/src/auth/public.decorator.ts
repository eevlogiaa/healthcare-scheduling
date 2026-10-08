import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip guard auth global buat handler/controller ini. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
