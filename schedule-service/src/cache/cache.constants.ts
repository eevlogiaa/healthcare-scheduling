export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Grup hasil query di cache yang di-invalidate barengan. */
export enum CacheNamespace {
  Customers = 'customers',
  Doctors = 'doctors',
  Schedules = 'schedules',
}
