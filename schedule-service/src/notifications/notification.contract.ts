/**
 * Kontrak message antara schedule-service & notification-service.
 * Wajib sama persis dengan notification-service/src/notifications/notification.contract.ts.
 */
export const EMAIL_QUEUE = 'email';
export const SCHEDULE_NOTIFICATION_JOB = 'schedule-notification';

export enum ScheduleEvent {
  Created = 'SCHEDULE_CREATED',
  Deleted = 'SCHEDULE_DELETED',
}

export interface ScheduleNotificationJob {
  event: ScheduleEvent;
  scheduleId: string;
  objective: string;
  /** format ISO 8601 */
  scheduledAt: string;
  customer: { name: string; email: string };
  doctor: { name: string };
}
