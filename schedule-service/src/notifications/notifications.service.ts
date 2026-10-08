import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { ScheduleWithRelations } from '../schedules/schedule-with-relations';
import {
  EMAIL_QUEUE,
  SCHEDULE_NOTIFICATION_JOB,
  ScheduleEvent,
  ScheduleNotificationJob,
} from './notification.contract';

/** Publish job email ke queue, yang ngirim nanti notification-service. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<ScheduleNotificationJob>) {}

  scheduleCreated(schedule: ScheduleWithRelations): Promise<void> {
    return this.publish(ScheduleEvent.Created, schedule);
  }

  scheduleDeleted(schedule: ScheduleWithRelations): Promise<void> {
    return this.publish(ScheduleEvent.Deleted, schedule);
  }

  /** Gak pernah throw: notif gagal jangan sampe bikin operasi jadwalnya ikut gagal. */
  private async publish(event: ScheduleEvent, schedule: ScheduleWithRelations): Promise<void> {
    const job: ScheduleNotificationJob = {
      event,
      scheduleId: schedule.id,
      objective: schedule.objective,
      scheduledAt: schedule.scheduledAt.toISOString(),
      customer: { name: schedule.customer.name, email: schedule.customer.email },
      doctor: { name: schedule.doctor.name },
    };

    try {
      await this.queue.add(SCHEDULE_NOTIFICATION_JOB, job, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100,
      });
    } catch (error) {
      this.logger.error(
        `Could not enqueue ${event} email for schedule ${schedule.id}: ${(error as Error).message}`,
      );
    }
  }
}
