import { getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Job } from 'bull';
import { MailService } from '../mail/mail.service';
import {
  EMAIL_QUEUE,
  SCHEDULE_NOTIFICATION_JOB,
  ScheduleEvent,
  ScheduleNotificationJob,
} from './notification.contract';
import { ScheduleNotificationProcessor } from './schedule-notification.processor';

const data: ScheduleNotificationJob = {
  event: ScheduleEvent.Created,
  scheduleId: 'schedule-1',
  objective: 'Annual check-up',
  scheduledAt: '2030-01-15T02:00:00.000Z',
  customer: { name: 'Jane Doe', email: 'jane@example.com' },
  doctor: { name: 'Dr. House' },
};

type FakeJob = Pick<Job<ScheduleNotificationJob>, 'id' | 'data' | 'opts' | 'attemptsMade'>;

// Job di typings bull cuma interface (gak ada constructor publik), jadi cast-nya cukup di sini aja
function makeJob(overrides: Partial<FakeJob> = {}): Job<ScheduleNotificationJob> {
  const job: FakeJob = { id: 42, data, opts: { attempts: 5 }, attemptsMade: 1, ...overrides };
  return job as Job<ScheduleNotificationJob>;
}

describe('ScheduleNotificationProcessor', () => {
  let mail: { send: jest.Mock };
  let queue: { process: jest.Mock; on: jest.Mock };
  let processor: ScheduleNotificationProcessor;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  beforeEach(async () => {
    mail = { send: jest.fn().mockResolvedValue(undefined) };
    queue = { process: jest.fn().mockResolvedValue(undefined), on: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScheduleNotificationProcessor,
        { provide: getQueueToken(EMAIL_QUEUE), useValue: queue },
        { provide: MailService, useValue: mail },
        {
          provide: ConfigService,
          useValue: new ConfigService({ APP_TIMEZONE: 'Asia/Jakarta', QUEUE_CONCURRENCY: 7 }),
        },
      ],
    }).compile();
    processor = moduleRef.get(ScheduleNotificationProcessor);
  });

  it('registers the job handler with the configured concurrency', async () => {
    processor.onModuleInit();

    expect(queue.process).toHaveBeenCalledWith(SCHEDULE_NOTIFICATION_JOB, 7, expect.any(Function));
    expect(queue.on).toHaveBeenCalledWith('failed', expect.any(Function));

    const [, , handler] = queue.process.mock.calls[0];
    await handler(makeJob());
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('emails the customer', async () => {
    await processor.handle(makeJob());

    expect(mail.send).toHaveBeenCalledWith({
      to: 'jane@example.com',
      subject: 'Consultation booked with Dr. House',
      text: expect.stringContaining('09:00 (Asia/Jakarta)'),
      html: expect.stringContaining('Hello Jane Doe'),
    });
  });

  it('lets a send failure propagate so Bull retries the job', async () => {
    mail.send.mockRejectedValue(new Error('SMTP down'));
    await expect(processor.handle(makeJob())).rejects.toThrow('SMTP down');
  });

  it('logs whether a failed job will be retried', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn');

    processor.onFailed(makeJob({ attemptsMade: 1 }), new Error('SMTP down'));
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('attempt 1/5, will retry'));

    processor.onFailed(makeJob({ attemptsMade: 5 }), new Error('SMTP down'));
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('attempt 5/5, giving up'));
  });
});
