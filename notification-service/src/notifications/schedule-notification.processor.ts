import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bull';
import { EnvironmentVariables } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import {
  EMAIL_QUEUE,
  SCHEDULE_NOTIFICATION_JOB,
  ScheduleNotificationJob,
} from './notification.contract';
import { renderScheduleEmail } from './schedule-email.template';

@Injectable()
export class ScheduleNotificationProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScheduleNotificationProcessor.name);
  private readonly timeZone: string;
  private readonly concurrency: number;

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<ScheduleNotificationJob>,
    private readonly mail: MailService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.timeZone = config.get('APP_TIMEZONE', { infer: true });
    this.concurrency = config.get('QUEUE_CONCURRENCY', { infer: true });
  }

  // handler didaftarin manual, soalnya @Process cuma bisa terima concurrency statis
  onModuleInit(): void {
    this.queue
      .process(SCHEDULE_NOTIFICATION_JOB, this.concurrency, (job) => this.handle(job))
      .catch((error: Error) =>
        this.logger.error(`Email queue processor stopped: ${error.message}`),
      );
    this.queue.on('failed', (job: Job<ScheduleNotificationJob>, error: Error) =>
      this.onFailed(job, error),
    );
  }

  /** Kalo throw, Bull bakal retry job-nya sesuai backoff dari producer. */
  async handle(job: Job<ScheduleNotificationJob>): Promise<void> {
    const { event, scheduleId, customer } = job.data;
    const email = renderScheduleEmail(job.data, this.timeZone);
    await this.mail.send({ to: customer.email, ...email });
    this.logger.log(`Sent ${event} email for schedule ${scheduleId} (job ${job.id})`);
  }

  onFailed(job: Job<ScheduleNotificationJob>, error: Error): void {
    const attempts = job.opts.attempts ?? 1;
    const outcome = job.attemptsMade >= attempts ? 'giving up' : 'will retry';
    this.logger.warn(
      `Email job ${job.id} for schedule ${job.data.scheduleId} failed ` +
        `(attempt ${job.attemptsMade}/${attempts}, ${outcome}): ${error.message}`,
    );
  }
}
