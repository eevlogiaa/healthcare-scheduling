import { Prisma } from '@prisma/client';

/** Schedule selalu di-load bareng customer & dokternya. */
export const SCHEDULE_INCLUDE = { customer: true, doctor: true } satisfies Prisma.ScheduleInclude;

export type ScheduleWithRelations = Prisma.ScheduleGetPayload<{ include: typeof SCHEDULE_INCLUDE }>;
